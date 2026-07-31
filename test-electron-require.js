try {
  // Try the CommonJS way
  const electron = require('electron');
  console.log('electron type:', typeof electron);

  // Check if process.type is available (should be 'browser' for main process)
  console.log('process.type:', process.type);
  console.log('process.versions.electron:', process.versions.electron);
  console.log('process.resourcesPath:', process.resourcesPath);
} catch(e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack?.split('\n').slice(0,5).join('\n'));
}
