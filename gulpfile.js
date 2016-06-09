const gulp = require('gulp');
const sass = require('gulp-sass');
const server = require('gulp-express');
const babel = require('gulp-babel');
const transpile  = require('gulp-es6-module-transpiler');

const paths = {
  node: 'index.js',
  js: './js/**/*.jsx',
  sass: './sass/**/*.sass',
  cssOut: './static/css'
};

gulp.task('sass', function () {
  return gulp.src(paths.sass)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(paths.cssOut));
});

gulp.task('server', () => {
  server.run(['index.js']);
  gulp.watch(paths.node, server.run);
});

gulp.task('watch', () => {
  gulp.watch(paths.sass, ['sass']);
});

gulp.task('default', ['server', 'watch']);
