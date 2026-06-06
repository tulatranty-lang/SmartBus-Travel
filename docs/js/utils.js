window.SmartBusUtils = window.SmartBusUtils || {};
window.SmartBusUtils.escapeHtml = function(value){return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');};
window.SmartBusUtils.debounce = function(fn, wait=300){let t;return (...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};};
