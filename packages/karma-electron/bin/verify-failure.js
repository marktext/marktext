#!/usr/bin/env node
// Load in our dependencies
// DEV: This script helps us verify failures occur while not scaring users too much
// https://github.com/kentcdodds/cross-env/blob/v1.0.7/bin/cross-env.js#L3
var crossEnv = require('cross-env/dist');

// Send a warning note to the user
console.error('THE PROCEEDING COMMAND IS EXPECTED TO FAIL. NOTHING IS WRONG.');
console.error('THE PROCEEDING COMMAND IS EXPECTED TO FAIL. NOTHING IS WRONG.');
console.error('THE PROCEEDING COMMAND IS EXPECTED TO FAIL. NOTHING IS WRONG.');

// Run our command
// https://github.com/kentcdodds/cross-env/blob/v1.0.7/bin/cross-env.js#L3
var proc = crossEnv(process.argv.slice(2));

// Flush the existing exit call
// https://github.com/kentcdodds/cross-env/blob/v1.0.7/src/index.js#L11
proc.removeAllListeners('exit');

// When we exit
// https://github.com/kentcdodds/cross-env/blob/v1.0.7/src/index.js#L11
proc.on('exit', function handleExit (code) {
  // If we failed as intended, tell the user nothing is wrong and exit successfully
  if (code !== 0) {
    console.error('THE COMMAND FAILED AS EXPECTED. NOTHING IS WRONG.');
    console.error('THE COMMAND FAILED AS EXPECTED. NOTHING IS WRONG.');
    console.error('THE COMMAND FAILED AS EXPECTED. NOTHING IS WRONG.');
    process.exit(0);
    return;
  }

  // Otherwise, tell the user everything is wrong and exit with a bad exit code
  console.error('THE COMMAND DID NOT FAIL AS EXPECTED. SOMETHING IS WRONG.');
  console.error('THE COMMAND DID NOT FAIL AS EXPECTED. SOMETHING IS WRONG.');
  console.error('THE COMMAND DID NOT FAIL AS EXPECTED. SOMETHING IS WRONG.');
  process.exit(1);
});
