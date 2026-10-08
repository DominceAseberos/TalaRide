// Node --require executes this before test modules (and react-test-renderer) load.
// Production React excludes React.act, so tests using react-test-renderer must
// never inherit NODE_ENV=production from a CI or container parent process.
process.env.NODE_ENV = 'test';
