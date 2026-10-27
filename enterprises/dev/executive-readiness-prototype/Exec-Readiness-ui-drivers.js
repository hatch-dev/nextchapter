/* ============================================================
   ui-drivers.js  —  Page-level UI behaviour drivers
   (extracted verbatim from the trailing <script> blocks)
     1. Custom cursor: instant dot + eased trailing ring.
     2. Sidebar: anchor clicked item to the top on click.
     3. YouTube facade: swap thumbnail for player on click.
   ============================================================ */

/* 1. Custom cursor driver */
(function(){
  if(!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
  var dot=document.getElementById('cursor'), ring=document.getElementById('cursorRing');
  if(!dot||!ring) return;
  document.documentElement.classList.add('has-custom-cursor');
  var mx=window.innerWidth/2, my=window.innerHeight/2;
  var rx=mx, ry=my, shown=false;
  function show(){ if(!shown){ shown=true; dot.style.opacity='1'; ring.style.opacity='1'; } }
  function hide(){ shown=false; dot.style.opacity='0'; ring.style.opacity='0'; }
  document.addEventListener('mousemove', function(e){
    mx=e.clientX; my=e.clientY;
    dot.style.transform='translate('+mx+'px,'+my+'px) translate(-50%,-50%)';
    show();
  }, {passive:true});
  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
  (function loop(){ rx+=(mx-rx)*0.18; ry+=(my-ry)*0.18; ring.style.transform='translate('+rx+'px,'+ry+'px) translate(-50%,-50%)'; requestAnimationFrame(loop); })();
  var SEL='a,button,[onclick],[role="button"],input,textarea,select,label,.nav-tab,.sidebar-step,.sidebar-home,.sidebar-outcome,.sidebar-phase-head,.sidebar-mini-row';
  document.addEventListener('mouseover', function(e){ if(e.target.closest && e.target.closest(SEL)) document.documentElement.classList.add('cursor-hover'); });
  document.addEventListener('mouseout', function(e){ if(e.target.closest && e.target.closest(SEL)){ var to=e.relatedTarget; if(!to || !(to.closest && to.closest(SEL))) document.documentElement.classList.remove('cursor-hover'); } });
  document.addEventListener('mousedown', function(){ document.documentElement.classList.add('cursor-down'); });
  document.addEventListener('mouseup',   function(){ document.documentElement.classList.remove('cursor-down'); });
})();

/* 2. Sidebar anchor-on-click */
(function(){
  var SB_ITEM='.sidebar-step,.sidebar-home,.sidebar-outcome,.sidebar-phase-head,.sidebar-mini-row';
  document.addEventListener('click', function(e){
    var sb=document.getElementById('erSidebar');
    if(!sb) return;
    var item=e.target.closest && e.target.closest(SB_ITEM);
    if(!item || !sb.contains(item)) return;
    var key=item.getAttribute('onclick')||item.textContent;
    requestAnimationFrame(function(){
      var scroll=document.querySelector('#erSidebar .sidebar-scroll');
      if(!scroll) return;
      var items=scroll.querySelectorAll(SB_ITEM), match=null;
      for(var i=0;i<items.length;i++){ if((items[i].getAttribute('onclick')||items[i].textContent)===key){ match=items[i]; break; } }
      if(!match) return;
      var ANCHOR_OFFSET=16;
      var sRect=scroll.getBoundingClientRect(), iRect=match.getBoundingClientRect();
      scroll.scrollTo({ top: scroll.scrollTop + (iRect.top - sRect.top) - ANCHOR_OFFSET, behavior:'smooth' });
    });
  }, true);
})();

/* 3. YouTube facade */
(function(){
  function load(f){
    var id=f.getAttribute('data-yt'); if(!id) return;
    if(location.protocol==='file:'){ window.open('https://www.youtube.com/watch?v='+id,'_blank','noopener'); return; }
    var src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&playsinline=1';
    f.innerHTML='<iframe src="'+src+'" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    f.classList.remove('yt-facade'); f.removeAttribute('role'); f.removeAttribute('tabindex');
  }
  document.addEventListener('click', function(e){ var f=e.target.closest && e.target.closest('.yt-facade[data-yt]'); if(f) load(f); });
  document.addEventListener('keydown', function(e){ if(e.key!=='Enter' && e.key!==' ') return; var f=e.target.closest && e.target.closest('.yt-facade[data-yt]'); if(f){ e.preventDefault(); load(f); } });
})();
