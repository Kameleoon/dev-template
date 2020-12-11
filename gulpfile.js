const gulp = require('gulp');
const { build } = require('./gulp-tasks/build');
const { deploy } = require('./gulp-tasks/deploy');

gulp.task(build);
gulp.task('deploy', deploy);
