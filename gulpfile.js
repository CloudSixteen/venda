var browserify = require("browserify");
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var gulp = require("gulp");
var uglify = require("gulp-uglify");
var tslint = require("gulp-tslint");
var tsc = require("gulp-typescript");
var open = require("gulp-open");
var del = require("del");

var project = tsc.createProject("tsconfig.json");

/*
    Remove all files from the build directory before building
    a new release of the server.
*/
gulp.task("clean", function() {
    return del(["build/**/**.*", "build/**"], {force: true});
});

/*
    Compile the TypeScript source into JavaScript and place
    the new files in the build directory.
*/
gulp.task("build", [/*"clean"*/], function() {
	var build = gulp.src([
		"app/types/types.d.ts",
		"app/**/**.ts"
    ])
    .pipe(project())
    .js.pipe(gulp.dest("build/"));

	return build;
});

/*
    Lint the source TypeScript files using the tslist.json
    file at the project root.
*/
gulp.task("lint", function() {
    return gulp.src([
        "app/**/**.ts"
    ])
    .pipe(tslint({}))
    .pipe(tslint.report("verbose"));
});

/*
    Open the built website using the operating system's
    default browser.
*/
gulp.task("open", function(){
  gulp.src(__filename)
  .pipe(open({uri: "http://localhost:3002"}));
});
