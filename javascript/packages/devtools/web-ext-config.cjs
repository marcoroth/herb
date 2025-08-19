module.exports = {
  sourceDir: './dist',
  artifactsDir: './packages',
  build: {
    overwriteDest: true
  },
  run: {
    firefox: 'firefox', // or specific path like '/Applications/Firefox.app/Contents/MacOS/firefox'
    startUrl: [
      'http://localhost:3000'
    ]
  },
  lint: {
    pretty: true,
    warningsAsErrors: false
  }
};
