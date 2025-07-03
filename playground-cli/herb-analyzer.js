#!/usr/bin/env node

import { readFileSync } from 'fs';
import { Herb } from '@herb-tools/node-wasm';
import { Linter } from '@herb-tools/linter';

async function safeExecute(promise) {
  try {
    return await promise;
  } catch (error) {
    // Only log to stderr, not stdout to avoid corrupting JSON
    console.error('SafeExecute error:', error);
    return `Error: ${error.message || error.toString()}`;
  }
}

async function analyze() {
  try {
    // Load Herb WASM
    await Herb.load();
    
    const filepath = process.argv[2];
    if (!filepath) {
      console.error('Usage: node herb-analyzer.js <erb-file>');
      process.exit(1);
    }
    
    const source = readFileSync(filepath, 'utf-8');
    const startTime = performance.now();

    // Parse the ERB source
    const parseResult = await safeExecute(
      new Promise((resolve) => resolve(Herb.parse(source)))
    );

    // Get string representation of parse result
    const parseString = await safeExecute(
      new Promise((resolve) => resolve(parseResult.value ? parseResult.value.inspect() : 'Parse failed'))
    );

    // Get JSON representation of parse result
    const parseJson = await safeExecute(
      new Promise((resolve) => 
        resolve(parseResult.value ? JSON.stringify(parseResult.value, null, 2) : 'Parse failed')
      )
    );

    // Lex the ERB source
    const lexResult = await safeExecute(
      new Promise((resolve) => resolve(Herb.lex(source)))
    );

    // Get string representation of lex result
    const lexString = await safeExecute(
      new Promise((resolve) => resolve(lexResult.value ? lexResult.value.inspect() : 'Lex failed'))
    );

    // Extract Ruby code
    const ruby = await safeExecute(
      new Promise((resolve) => resolve(Herb.extractRuby(source)))
    );

    // Extract HTML
    const html = await safeExecute(
      new Promise((resolve) => resolve(Herb.extractHTML(source)))
    );

    // Get version
    const version = await safeExecute(
      new Promise((resolve) => resolve(Herb.version))
    );

    // Run linter if parse was successful
    let lintResult = null;
    if (parseResult && parseResult.value) {
      const linter = new Linter();
      lintResult = await safeExecute(
        new Promise((resolve) => resolve(linter.lint(parseResult.value)))
      );
    }

    const endTime = performance.now();

    // Format results for CLI consumption
    const result = {
      parse: parseString || 'Parse failed',
      parseJson: parseJson || 'Parse failed',
      lex: lexString || 'Lex failed',
      ruby: ruby || 'No Ruby code found',
      html: html || 'No HTML found',
      linter: formatLinterResult(lintResult, parseResult),
      version: version || 'unknown',
      duration: endTime - startTime,
      success: !!(parseResult && parseResult.value)
    };

    // Ensure we output valid JSON
    try {
      console.log(JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.log(JSON.stringify({
        error: 'Failed to serialize result: ' + jsonError.message,
        parse: 'Serialization failed',
        lex: 'Serialization failed',
        ruby: 'Serialization failed',
        html: 'Serialization failed',
        linter: 'Serialization failed',
        success: false
      }, null, 2));
    }

  } catch (error) {
    console.log(JSON.stringify({
      error: error.message,
      parse: 'Analysis failed',
      lex: 'Analysis failed', 
      ruby: 'Analysis failed',
      html: 'Analysis failed',
      linter: 'Analysis failed',
      success: false
    }, null, 2));
    process.exit(1);
  }
}

function formatLinterResult(lintResult, parseResult) {
  if (!lintResult) {
    if (!parseResult || !parseResult.value) {
      return '❌ Parse failed - cannot run linter';
    }
    return '❌ Linter failed to run';
  }

  const messages = lintResult.messages || [];
  const errors = lintResult.errors || 0;
  const warnings = lintResult.warnings || 0;

  if (errors === 0 && warnings === 0) {
    return '✅ No linting issues found!\n\nYour ERB code follows all linting rules and best practices.';
  }

  let result = [];
  result.push('🔍 Linting Results');
  result.push('==================');
  result.push('');
  
  if (errors > 0) {
    result.push(`❌ ${errors} error(s) found:`);
  }
  if (warnings > 0) {
    result.push(`⚠️  ${warnings} warning(s) found:`);
  }
  result.push('');

  messages.forEach((message, index) => {
    const icon = message.severity === 'error' ? '❌' : '⚠️ ';
    const location = message.location ? 
      `Line ${message.location.start.line}, Column ${message.location.start.column}` : 
      'Unknown location';
    
    result.push(`${icon} ${message.rule || 'unknown-rule'}`);
    result.push(`   ${message.message}`);
    result.push(`   Location: ${location}`);
    result.push('');
  });

  return result.join('\n');
}

// Run the analysis
analyze();