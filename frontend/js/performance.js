(function(){
  window.addEventListener('error', function(ev){ if(window.console) console.warn('[SmartBus UI]', ev.message); });
  window.addEventListener('unhandledrejection', function(ev){ if(window.console) console.warn('[SmartBus Promise]', ev.reason?.message || ev.reason); });
  document.addEventListener('DOMContentLoaded', function(){
    var nearest=document.getElementById('landing-nearest-stop-cta');
    if(nearest){ nearest.addEventListener('click', function(){ document.getElementById('landing-open-dashboard')?.click(); setTimeout(function(){ document.getElementById('chat-gps-btn')?.click(); }, 500); }); }
  });
})();
