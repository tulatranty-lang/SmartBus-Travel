// Static host: the owner configures this API once. Express serves a same-origin value.
window.SMARTBUS_API_BASE=window.SMARTBUS_API_BASE||(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'http://localhost:5000/api/v1':'https://smartbus-backend-xr34.onrender.com/api/v1');
window.SMARTBUS_SIMULATION=window.SMARTBUS_SIMULATION===true;
