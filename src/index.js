// https://www.kaggle.com/rounakbanik/the-movies-dataset/data
// Exercise: Use credits data with crew and cast too
// Exercise: Make feature more weighted based on popularity or actors

import fs from 'fs';
import csv from 'fast-csv';

import prepareRatings from './preparation/ratings';
import prepareMovies from './preparation/movies';
import predictWithLinearRegression from './strategies/linearRegression';
import predictWithContentBased, { getMovieIndexByTitle } from './strategies/contentBased';
import { predictWithCfUserBased, predictWithCfItemBased } from './strategies/collaborativeFiltering/itemBased';

let MOVIES_META_DATA = {};
let MOVIES_KEYWORDS = {};
let RATINGS = [];

let ME_USER_ID = 0;

let moviesMetaDataPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/movies_metadata.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromMetaDataFile)
    .on('end', () => resolve(MOVIES_META_DATA)));

let moviesKeywordsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/keywords.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromKeywordsFile)
    .on('end', () => resolve(MOVIES_KEYWORDS)));

let ratingsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./src/data/ratings_small.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromRatingsFile)
    .on('end', () => resolve(RATINGS)));

function fromMetaDataFile(row) {
  MOVIES_META_DATA[row.id] = {
    id: row.id,
    adult: row.adult,
    budget: row.budget,
    genres: softEval(row.genres, []),
    homepage: row.homepage,
    language: row.original_language,
    title: row.original_title,
    overview: row.overview,
    popularity: row.popularity,
    studio: softEval(row.production_companies, []),
    release: row.release_date,
    revenue: row.revenue,
    runtime: row.runtime,
    voteAverage: row.vote_average,
    voteCount: row.vote_count,
  };
}

function fromKeywordsFile(row) {
  MOVIES_KEYWORDS[row.id] = {
    keywords: softEval(row.keywords, []),
  };
}

function fromRatingsFile(row) {
  RATINGS.push(row);
}

console.log('Unloading data from files ... \n');

Promise.all([
  moviesMetaDataPromise,
  moviesKeywordsPromise,
  ratingsPromise,
]).then(init);

function init([ moviesMetaData, moviesKeywords, ratings ]) {
  /* ------------ */
  //  Preparation //
  /* -------------*/

  const {
    MOVIES_BY_ID,
    MOVIES_IN_LIST,
    X,
  } = prepareMovies(moviesMetaData, moviesKeywords);

  let ME_USER_RATINGS = [
    // Sample User One
    addUserRating(ME_USER_ID, 'The Dark Knight', '5.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'The Dark Knight Rises', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Batman: Under the Red Hood', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Sherlock Holmes: A Game of Shadows', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Lovecraft: Fear of the Unknown', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Batman & Robin', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Iron Man', '5.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Sissi', '1.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Titanic', '1.0', MOVIES_IN_LIST),

    // Sample User Two
    // addUserRating(ME_USER_ID, 'Inception', '5.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'Interstellar', '4.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'Forrest Gump', '3.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'Fight Club', '4.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'Back to the Future', '3.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'The Godfather', '4.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'Pulp Fiction', '5.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'Mean Girls', '1.0', MOVIES_IN_LIST),
    // addUserRating(ME_USER_ID, 'The Breakfast Club', '1.0', MOVIES_IN_LIST),
  ];

  const {
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
  } = prepareRatings([ ...ME_USER_RATINGS, ...ratings ]);

  /* ----------------------------- */
  //  Linear Regression Prediction //
  //        Gradient Descent       //
  /* ----------------------------- */

  /*** UNCOMMENT TO USE RECOMMENDER STRATEGY

  console.log('Linear Regression Prediction ... \n');

  console.log('(1) Training \n');
  const meUserRatings = ratingsGroupedByUser[ME_USER_ID];
  const linearRegressionBasedRecommendation = predictWithLinearRegression(X, MOVIES_IN_LIST, meUserRatings);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(linearRegressionBasedRecommendation, MOVIES_BY_ID, 10, true));

  ***/

  /* ------------------------- */
  //  Content-Based Prediction //
  //  Cosine Similarity Matrix //
  /* ------------------------- */

  /*** UNCOMMENT TO USE RECOMMENDER STRATEGY

  console.log('Content-Based Prediction ... \n');

  console.log('(1) Computing Cosine Similarity \n');
  const title = 'Batman Begins';
  const contentBasedRecommendation = predictWithContentBased(X, MOVIES_IN_LIST, title);

  console.log(`(2) Prediction based on "${title}" \n`);
  console.log(sliceAndDice(contentBasedRecommendation, MOVIES_BY_ID, 10, true));

  ***/

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             Item-Based              //
  /* ----------------------------------- */

  console.log('Collaborative-Filtering Prediction ... \n');

  console.log('(1) Computing Item-Based Cosine Similarity \n');

  const cfItemBasedRecommendation = predictWithCfItemBased(
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
    ME_USER_ID
  );

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfItemBasedRecommendation, MOVIES_BY_ID, 30, true));

  console.log('\n');
  console.log('End ...');
}

// Utility

export function addUserRating(userId, searchTitle, rating, MOVIES_IN_LIST) {
  const { id, title } = getMovieIndexByTitle(MOVIES_IN_LIST, searchTitle);

  return {
    userId,
    rating,
    movieId: id,
    title,
  };
}

export function sliceAndDice(recommendations, MOVIES_BY_ID, count, onlyTitle) {
  recommendations = recommendations.filter(recommendation => MOVIES_BY_ID[recommendation.movieId]);

  recommendations = onlyTitle
    ? recommendations.map(mr => ({ title: MOVIES_BY_ID[mr.movieId].title, prediction: mr.prediction }))
    : recommendations.map(mr => ({ movie: MOVIES_BY_ID[mr.movieId], prediction: mr.prediction }));

  return recommendations
    .slice(0, count);
}

export function softEval(string, escape) {
  if (!string) {
    return escape;
  }

  try {
    return eval(string);
  } catch (e) {
    return escape;
  }
}