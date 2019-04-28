// Verify Karma catches uncaught exceptions
throw new Error('This error should not be caught and cause Karma to fail');
