var child = require('child_process');
var path = require('path');
var mkdirp = require('mkdirp');
var uuid = require('node-uuid');
var rimraf = require('rimraf');
var os = require('os');
var fs = require('fs');

module.exports.requestCompilation = function(package, callback) {
  var libpaths = package.libraries || [];
  var hwpaths = package.hardware || [];
  var toolspaths = package.tools || [];
  var sketchfile = path.resolve(package.sketch);
  var board = package.board || 'uno';
  var version = package.version || '10609';
  var builder = package.builder;
  var manufacturer = package.manufacturer || 'arduino';
  var arch = package.arch || 'avr';

  var id = uuid.v1();
  var paths = {};
  paths.dest = path.join(os.homedir(), '.avrpizza', 'tmp', id);

  mkdirp(paths.dest);

  var customLibsArgs = libpaths.map(function(lpath) {
    return '-libraries="' + path.dirname(lpath) + '"';
  });

  var customHardwareArgs = hwpaths.map(function(lpath) {
    return '-hardware="' + lpath + '"';
  });

  var customToolsArgs = toolspaths.map(function(lpath) {
    return '-tools="' + lpath + '"';
  });

  // TODO: DRY this the heck up, gosh.
  switch (os.platform()) {
    case 'darwin': {
      // theoretically the user would supply the direct path to the Arduino.app location, including the app file in the path
      builderPath = path.join(builder.location, 'Contents', 'Java');
      paths.tools = path.join(builderPath, 'hardware', 'tools');
      paths.libs =  path.join(builderPath, 'libraries');
      paths.hardware = path.join(builderPath, 'hardware');
      paths.toolsBuilder = path.join(builderPath, 'tools-builder');
      paths.builderExec = path.join(builderPath, 'arduino-builder');
      break;
    }

    case 'linux': {
      builderPath = builder.location;
      paths.tools = path.join(builderPath, 'hardware', 'tools');
      paths.libs =  path.join(builderPath, 'libraries');
      paths.hardware = path.join(builderPath, 'hardware');
      paths.toolsBuilder = path.join(builderPath, 'tools-builder');
      paths.builderExec = path.join(builderPath, 'arduino-builder');
      break;
    }

    case 'win32': {
      builderPath = builder.location;
      paths.tools = path.join(builderPath, 'hardware', 'tools');
      paths.libs =  path.join(builderPath, 'libraries');
      paths.hardware = path.join(builderPath, 'hardware');
      paths.toolsBuilder = path.join(builderPath, 'tools-builder');
      paths.builderExec = '"' + path.join(builderPath, 'arduino-builder') + '"';
      break;
    }

    default: {
      var error = new Error('Oops! Sorry, local build is currently an unsupported feature on your platform, check back soon.');
      return callback(error);
      break;
    }
  }

  function compile(callback) {

    // assemble all options and flags for Arduino Builder based on the facts
    var builderString = [
      '-compile',
      '-hardware="' + paths.hardware + '"',
      '-tools="' + paths.tools + '"',
      '-tools="' + paths.toolsBuilder + '"',
      '-fqbn="' + manufacturer + ':' + arch + ':' + board + '"',
      '-built-in-libraries="' + paths.libs + '"',
      customLibsArgs.join(' '),
      customHardwareArgs.join(' '),
      customToolsArgs.join(' '),
      '-ide-version="' + version + '"',
      '-build-path="' + paths.dest + '"',
      '-debug-level="10' + '"',
      // '-warnings=none',
      '"' + sketchfile + '"'
    ].join(' ');

    // run Arduino Builder in a child process (yay cmd line apps)
    var builderChild = child.exec(paths.builderExec + ' ' + builderString, function(error) {
      // something went wrong
      if (error) return callback(error);

      // open the compiled file to send the buffer with callback
      fs.readFile(path.join(paths.dest, path.basename(sketchfile)) + '.hex', function(error, file) {
        // delete the temp build directory
        rimraf(paths.dest, function(error) {
          return callback(error, file);
        });
      });
    });
  }

  compile(callback);
}
