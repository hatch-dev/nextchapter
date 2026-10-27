/* ─────────────────────────────────────────────────────
   pages/reports.js — the Report Manager
   ─────────────────────────────────────────────────────
   Where the user assembles several outputs and Phase 5 pages into one
   printed report: a cover, a contents page, an introduction, then each
   chosen item as a numbered section. A report is a named definition on
   the organization (data.reportDefs) holding an ordered list of units
   — an output, a Phase 5 page, a single idea, or a text page the user
   writes — with a Summary / Full depth where the unit offers one and a
   note per section. Nothing here edits the record it prints.

   Family code: the same page exists in Responsible AI Governance and in
   Executive Readiness. It arrived here from
   reference/Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md,
   steps 160–203, applied by tools/port-pipeline-directive.js — which is
   where any change to it belongs, not in this file.

   Its page id is `reports`: routed by render() (js/app.js), kept in the
   sidebar by SIDEBAR_PAGES (js/features/sidebar.js), and reached from the
   More menu through the module's own moreItems (js/modules/pipeline/module.js).
   ───────────────────────────────────────────────── */

/* ══ /* ─ REPORT MANAGER (family code, ported from the Governance build 14 Sep 2026 and from Executive Readiness 16 Sep 2026; Spec Rev A §9). A named report definition on the organization holds an ordered list of units — outputs, Phase 5 pages, individual ideas, and text pages the user writes — with a depth where a unit has one and a note per section. The compiled document is one cover, a contents page, the introduction, and each unit as a numbered section. The record is never edited here. ─ */
function rcInp(label,id,val,ph){return '<div class="mb-4"><label class="form-label">'+esc(label)+'</label><input type="text" id="'+id+'" data-uncapped="1" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:100%"></div>'}
function rcBtnG(label,onclick,style){return '<button class="btn bg2" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
function rcBtnS(label,onclick,color,style){return '<button class="btn bp" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
function printDocumentPreview(title,content,opts){printDocument(title,content,'',opts)} /* the Report Manager's print and preview go through the shared window */
var RC_PAGE_UNITS=[['5.1','Pipeline Dashboard'],['cap-hub','Capital Planning Hub'],['mgmt-hub','Module Management']]; /* the Phase 5 pages a report can include, named as their documents are titled */
function rcUnitName(u){if(u.kind==='page'){var p=RC_PAGE_UNITS.filter(function(x){return x[0]===u.id})[0];if(p)return p[1]}return u.name||(u.kind==='text'?'Untitled page':'')} /* a page unit's name is read live, so a saved report follows a renaming */
function rcCatalogue(){var out=[];
  PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id==='cap-hub')return;if(PRINT_DOCS[o.id])out.push({kind:'output',id:o.id,name:o.name,group:'Outputs \u00b7 Phase '+p.id,depths:DEPTHED_OUTPUTS[o.id]?['summary','full']:null})})});
  RC_PAGE_UNITS.forEach(function(x){out.push({kind:'page',id:x[0],name:x[1],group:'Phase 5 pages'})});
  var st=getStages(),arch=data.archivedItems||{};(data.ideas||[]).forEach(function(d,i){if(!d||arch[i])return;out.push({kind:'record',type:'idea',id:String(i),name:d.name||'Unnamed idea',group:'Individual Ideas',rec:{i:i},sub:ideaStageWord(i,st)+(d.dept?' \u00b7 '+d.dept:'')})});
  return out} /* the catalogue: every output with a document, by phase (the Capital Planning Hub is a page, not an output); the three Phase 5 pages; every idea not archived, with its stage and department */
function ideaStageWord(i,st){st=st||getStages();if((st.operational||[]).indexOf(i)>=0)return 'Operational';if((st.experiment||[]).indexOf(i)>=0)return 'Development';if((st.noGo||[]).indexOf(i)>=0)return 'No-Go';if((st.explore||[]).indexOf(i)>=0)return 'Exploration';if((st.bluesky||[]).indexOf(i)>=0)return 'Blue Sky';return 'Archived'} /* an idea's stage in the pipeline's own words */
function rcKindLabel(u){return u.kind==='output'?'Output':u.kind==='page'?'Phase 5 page':u.kind==='text'?'Text page':u.kind==='record'?'Individual idea':''}
function rcUnitBody(u,lead){ /* the unit's content, no cover, no controls */
  var body='';var wasDepth=UI.printDepth,wasTab=UI.hubTab;
  try{
    if(u.kind==='output'&&u.id==='out-raci'){body=_rcStripCover(raciDoc({sectionHead:lead||''}))} /* the matrix opens on its own landscape page; the section heading rides into it */
    else if(u.kind==='output'){UI.printDepth=u.depth||'full';var fn=PRINT_DOCS[u.id];body=fn?_rcStripCover(fn()):''}
    else if(u.kind==='page'&&u.id==='5.1'){body=_rcStripCover(pipelineDashboardDoc())}
    else if(u.kind==='page'&&u.id==='cap-hub'){body=CAP_HUB_TABS.map(function(t,k){UI.hubTab=k;return erHead(t,'')+_rcStripCover(capHubDoc())}).join('')} /* in a report the hub prints all three tabs, each under its name */
    else if(u.kind==='page'&&u.id==='mgmt-hub'){body=_rcStripCover(mgmtHubDoc())}
    else if(u.kind==='record'&&u.type==='idea'){var i=+u.id;var d=(data.ideas||[])[i];var isProj=(data.selected||[]).indexOf(i)>=0;body=d?lyRender(isProj?'project':'idea',{i:i},'full',null):'<p style="font-size:13px;color:#666;font-style:italic">This idea is no longer on the record.</p>'} /* a selected idea is a project and prints the project record */
    else if(u.kind==='text'){body='<div class="rc-text" style="font-size:14px;line-height:1.7;color:#222">'+rcSanitize(u.html||'')+'</div>'}
  }finally{UI.printDepth=wasDepth;UI.hubTab=wasTab}
  return rcFirstRecordStays(body)}
function rcUnitGaps(u){if(u.kind==='record'&&u.type==='idea'){var i=+u.id;return (data.ideas||[])[i]?lyGaps('idea',[{i:i}],null):[]}return []} /* the idea map names no required layers; the list is empty by design */
function rcUnitFact(u){var n=function(c,w,pl){return c+' '+(c===1?w:(pl||w+'s'))};var st=getStages();
  if(u.kind==='output'){var cu=data.culture||{};var cs=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'].map(function(k){return typeof cu[k]==='number'?cu[k]:0}).reduce(function(a,b){return a+b},0);
    return ({'out-report':'Culture '+cs+' / 30','out-bluesky':n(st.bluesky.length,'idea'),'out-orgready':n((((data.ownership||{}).leads)||[]).filter(function(l){return l&&l.name}).length,'embedded lead'),'out-raci':n(raciCols().length,'role'),'out-explore':n(st.explore.length+(st.noGo||[]).length,'idea'),'out-capplan':(data.capital||{}).aiBudget?'Budget '+(data.capital||{}).aiBudget:'No budget set','out-expbriefs':n(st.experiment.length,'program'),'out-devport':n(st.experiment.length,'program'),'out-govfw':(data.governance||{}).threshold?'Threshold '+(data.governance||{}).threshold:'','out-orgrev':(function(){var x=data.stress||{};var sc=['decisions','ownership','incentives','culture'].map(function(k){return +x[k+'Score']||0}).filter(Boolean);return sc.length?'Average '+(sc.reduce(function(a,b){return a+b},0)/sc.length).toFixed(1)+' / 5':''})(),'out-finalport':(function(){var M=portfolioReviewModel();return M.decided+' of '+M.items.length+' decided'})(),'out-oper':n((st.operational||[]).length,'live project')})[u.id]||''}
  if(u.kind==='page'){if(u.id==='5.1')return n(bsNowList(st).length+st.explore.length+st.experiment.length+(st.operational||[]).length,'idea');if(u.id==='cap-hub')return (data.capital||{}).aiBudget?'Budget '+(data.capital||{}).aiBudget:'';if(u.id==='mgmt-hub'){var m=mgStats();return m.done+' of '+m.total+' steps'}return ''}
  if(u.kind==='record'){var i=+u.id;return (data.ideas||[])[i]?ideaStageWord(i,st):'No longer on the record'}
  if(u.kind==='text'){var words=String(u.html||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').trim().split(/\s+/).filter(Boolean).length;return words?n(words,'word'):'Nothing written yet'}
  return ''}
function rcUnitDesc(u){var m={
    'out-report':'Where the organization stands before the pipeline begins: its purpose and frictions, its AI knowledge, its culture, its innovation record, and who holds each decision right.',
    'out-bluesky':'Every idea not yet selected for exploration: the qualified ideas ranked by their Filter & Rank score, the ideas not yet qualified, the ideas that did not pass, and the ideas parked for the future.',
    'out-orgready':'How the organization is set up to run the pipeline: who owns it, who leads it inside the functions, how incentives are changing, and the rhythm the work keeps.',
    'out-raci':'Who is Responsible, Accountable, Consulted, and Informed for each of the pipeline\u2019s seven activities.',
    'out-explore':'The ideas selected for exploration: the deepened assessment, the Go / No-Go verdict, and the horizon, risk, and reward each was graded.',
    'out-capplan':'A point-in-time picture of the portfolio\u2019s capital: every budget year, then the total.',
    'out-expbriefs':'The programs in development: each one\u2019s brief and its track to date.',
    'out-devport':'The programs in development: each one\u2019s brief and its track to date.',
    'out-govfw':'The three mechanisms that keep innovation governed after day 90: the standing leadership agenda, the pipeline intake rule, and the quarterly review.',
    'out-orgrev':'The stress test of the organization\u2019s design after the first cycle, and the adjustments planned.',
    'out-finalport':'The first quarterly review of the live portfolio: the Buy, Hold, or Sell call on every initiative with its reasons, the portfolio\u2019s balance and capital after the decisions, and what the quarter taught.',
    'out-oper':'The projects live in the business: each one\u2019s health, launch date, and performance against its success metric.',
    'page:5.1':'The pipeline as it stands: its maturity, how far each phase has come, the next session and review, and every idea by stage.',
    'page:cap-hub':'The portfolio\u2019s committed costs and remaining budget, in its three views: Dashboard, Commitments, Plan & Funding.',
    'page:mgmt-hub':'Every step of the module in one place: who owns it, when it is due, and how completion is pacing against the 90 days.',
    'record:idea':'This idea\u2019s full record: the idea, its ranking, its exploration, its portfolio placement, its capital, its development brief and track, its review, and its operations.'};
  return m[u.kind==='output'?u.id:u.kind==='page'?'page:'+u.id:u.kind==='record'?'record:'+u.type:'']||''} /* one sentence per kind of content, in the same words as the documents' own covers */
function rcLeaderFilter(){return UI.rcF||(UI.rcF={q:'',st:'all'})} /* the Individual Ideas filters: a search, and the stage */
function rcSetFilter(k,v){var F=rcLeaderFilter();F[k]=v;render();if(k==='q'){var el=document.querySelector('input[type=search][placeholder^="Search ideas"]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}}
function rcLeaderPasses(rec,F){if(!rec)return false;var d=(data.ideas||[])[rec.i]||{};var q=(F.q||'').trim().toLowerCase();if(q&&((d.name||'')+' '+(d.dept||'')).toLowerCase().indexOf(q)<0)return false;if(F.st&&F.st!=='all'&&ideaStageWord(rec.i)!==F.st)return false;return true} /* an idea passes the Individual Ideas filters by name or department, and by stage */
function rcDefs(){if(!data.reportDefs)data.reportDefs=[];return data.reportDefs}
function rcNew(){var d={id:'rpt-'+Math.random().toString(36).slice(2,9),name:'New report',subtitle:'',intro:'',units:[],createdAt:Date.now()};rcDefs().push(d);UI.rcEdit=d.id;saveData();render()}
function rcFind(id){return rcDefs().find(function(d){return d.id===id})||null}
function rcSet(id,k,v){var d=rcFind(id);if(!d)return;d[k]=v;saveData()}
function rcSetNote(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].note=v;saveData()}
function rcSetDepth(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].depth=v;saveData();render()}
function rcToggle(id,key,depth){var d=rcFind(id);if(!d)return;var i=d.units.findIndex(function(u){return u.key===key});if(i>=0)d.units.splice(i,1);else{var c=rcCatalogue().find(function(u){return rcKey(u)===key});if(c)d.units.push({key:key,kind:c.kind,id:c.id,type:c.type||'',name:c.name,depth:c.depths?(depth==='full'?'full':'summary'):'',note:''})}saveData();render()} /* 14 Sep 2026: an option with a depth is added at the depth chosen */
function rcMove(id,i,dir){var d=rcFind(id);if(!d)return;var j=i+dir;if(j<0||j>=d.units.length)return;var t=d.units[i];d.units[i]=d.units[j];d.units[j]=t;saveData();render()}
function rcDelete(id){if(!confirm('Delete this report definition? The record it prints is untouched.'))return;data.reportDefs=rcDefs().filter(function(d){return d.id!==id});if(UI.rcEdit===id)UI.rcEdit=null;saveData();render()}
function rcDuplicate(id){var d=rcFind(id);if(!d)return;var c=JSON.parse(JSON.stringify(d));c.id='rpt-'+Math.random().toString(36).slice(2,9);c.name=d.name+' (copy)';c.createdAt=Date.now();rcDefs().push(c);UI.rcEdit=c.id;saveData();render()}
function rcKey(u){return u.kind+':'+(u.type?u.type+':':'')+u.id}
function _rcStripCover(doc){var i=doc.indexOf('min-height:85vh');if(i<0)return doc;var end=doc.indexOf('</div></div>',i);return end>0?doc.slice(end+12):doc} /* an output's own cover comes off inside a compiled report */
function rcFirstRecordStays(body){var a=body.indexOf('<table class="ly-rec"');if(a<0)return body;var b=body.indexOf('<table class="ly-rec"',a+10);var first=b>0?body.slice(a,b):body.slice(a);var fixed=first.replace('break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;','break-inside:auto;page-break-inside:auto;');return body.slice(0,a)+fixed+(b>0?body.slice(b):'')}
function rcCompile(id){ /* the whole document */
  var d=rcFind(id);if(!d)return '';
  var h=printDocCover(d.name||'Report',d.subtitle||'','');
  h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Contents</div>';
  d.units.forEach(function(u,i){h+='<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #eee;font-size:13px"><span style="font-family:var(--mono,monospace);color:#666;min-width:28px">'+(i+1)+'.</span><span>'+esc(rcUnitName(u))+(u.depth?' <span style="color:#888;font-size:11px">('+u.depth+')</span>':'')+'</span></div>'});
  var gaps=[];d.units.forEach(function(u,i){rcUnitGaps(u).forEach(function(g){gaps.push({sec:i+1,title:g.title,lines:g.lines})})});
  if(gaps.length){h+='<div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B3A1E;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #8B3A1E">What is missing ('+gaps.length+')</div>';
    gaps.forEach(function(g){h+='<div style="font-size:12.5px;padding:4px 0;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);color:#666">'+g.sec+'.</span> <strong>'+esc(g.title)+'</strong> \u2014 '+g.lines.map(esc).join(' ')+'</div>'})}
  h+='</div>';
  if(d.intro&&d.intro.trim())h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Introduction</div><div style="font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap">'+esc(d.intro)+'</div></div>';
  d.units.forEach(function(u,i){h+=rcSection(u,i)});
  return h}
function rcSection(u,i){ /* one numbered section as the report carries it: the number at the title's size (Paul's ruling, 14 Sep 2026), the heading, the note, the body — one definition for the compiled report and for the section preview */
  var head='<div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111"><span style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#888;margin-right:12px">'+(i+1)+'</span>'+esc(rcUnitName(u))+'</div>';
  if(u.note&&u.note.trim())head+='<div style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;padding:10px 14px;border-left:3px solid #999;white-space:pre-wrap">'+esc(u.note)+'</div>';
  if(u.kind==='output'&&u.id==='out-raci')return '<div>'+rcUnitBody(u,head)+'</div>'; /* the RACI matrix opens on its own landscape page; the heading sits at the top of that page, never alone before it */
  var h='<div style="page-break-before:always">'+head;
  return h+rcUnitBody(u)+'</div>'}
function rcPrint(id){var d=rcFind(id);if(!d)return;var doc=rcCompile(id);printDocumentPreview(d.name||'Report',doc)}
function rcSaveText(id,i){var el=document.getElementById('rc_txt_'+(rcFind(id).units[i]||{}).id);if(el)rcSetTextHtml(id,i,el.innerHTML);var hd=document.getElementById('rc_head_'+(rcFind(id).units[i]||{}).id);if(hd)rcSetUnit(id,i,'name',hd.value);UI.rcSel=null;render()} /* Save keeps the text and the heading and closes the inspector */
function rcPreviewUnit(id,i){var d=rcFind(id);if(!d||!d.units[i])return;var u=d.units[i];var title=(d.name||'Report')+' \u2014 section '+(i+1);printDocumentPreview(title,rcSection(u,i).replace('page-break-before:always','page-break-before:auto'),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the section as the report carries it — its number, heading, note, and body — with no cover of its own */
function rcAddText(id,at){var d=rcFind(id);if(!d)return;var u={key:'text:'+Math.random().toString(36).slice(2,9),kind:'text',id:'',type:'',name:'',html:'',depth:'',note:''};u.id=u.key.slice(5);if(at==null||at>=d.units.length)d.units.push(u);else d.units.splice(at,0,u);UI.rcSel=u.key;saveData();render()} /* the new page opens in the inspector */
function rcSetUnit(id,i,k,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i][k]=v;saveData()}
function rcRemoveAt(id,i){var d=rcFind(id);if(!d||!d.units[i])return;d.units.splice(i,1);saveData();render()}
function rcSetTextHtml(id,i,html){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].html=rcSanitize(html);saveData()}
function rcFmt(uid,cmd,val){var el=document.getElementById('rc_txt_'+uid);if(!el)return;el.focus();
  if(cmd==='bold'||cmd==='italic'){document.execCommand(cmd,false,null)}
  else if(cmd==='size'){document.execCommand('fontSize',false,{small:'2',normal:'3',large:'5',heading:'6'}[val]||'3')}
  el.dispatchEvent(new Event('input'))}
function rcSanitize(html){ /* authored text keeps only its shape: paragraphs, breaks, bold, italics, and a size; everything else is dropped */
  var root=document.createElement('div');root.innerHTML=String(html||'');
  var SIZE={'1':'11px','2':'12px','3':'14px','4':'16px','5':'18px','6':'22px','7':'26px'};
  var walk=function(node){var out='';for(var i=0;i<node.childNodes.length;i++){var n=node.childNodes[i];
    if(n.nodeType===3){out+=esc(n.nodeValue);continue}
    if(n.nodeType!==1)continue;var tag=n.tagName.toLowerCase();if(tag==='script'||tag==='style'||tag==='iframe'||tag==='object'||tag==='embed')continue;var inner=walk(n);
    if(tag==='br'){out+='<br>';continue}
    if(tag==='b'||tag==='strong'){out+='<b>'+inner+'</b>';continue}
    if(tag==='i'||tag==='em'){out+='<i>'+inner+'</i>';continue}
    if(tag==='p'||tag==='div'||tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4'||tag==='li'||tag==='ul'||tag==='ol'){var st='';if(tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4')st=' style="font-size:22px;font-weight:700"';var fs=n.style&&n.style.fontSize;if(fs&&/^\d+(\.\d+)?px$/.test(fs))st=' style="font-size:'+fs+'"';out+='<div'+st+'>'+inner+'</div>';continue}
    if(tag==='font'&&n.getAttribute('size')&&SIZE[n.getAttribute('size')]){out+='<span style="font-size:'+SIZE[n.getAttribute('size')]+(n.getAttribute('size')==='6'||n.getAttribute('size')==='7'?';font-weight:700':'')+'">'+inner+'</span>';continue}
    if(tag==='span'){var fs2=n.style&&n.style.fontSize;var fw=n.style&&n.style.fontWeight;var st2=[];if(fs2&&/^\d+(\.\d+)?px$/.test(fs2))st2.push('font-size:'+fs2);if(fw==='700'||fw==='bold')st2.push('font-weight:700');out+=st2.length?'<span style="'+st2.join(';')+'">'+inner+'</span>':inner;continue}
    out+=inner}return out};
  return walk(root)}
function rcPreview(id){var d=rcFind(id);if(!d)return;printDocumentPreview(d.name||'Report',rcCompile(id),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the report as it will print, at any point in the assembly, without the print dialog */
function renderReports(){ /* the Report Manager page (More menu). 14 Sep 2026 (Paul's ruling): a report is assembled from Report Content Options on the right into Sections on the left; every option that has a depth is added at Summary or Full; individual ideas can be filtered; text pages with a heading and a formatted body can be added anywhere; the report can be previewed at any point; the introduction and notes are uncapped */
  var defs=rcDefs();var ed=UI.rcEdit?rcFind(UI.rcEdit):null;
  var h='<div class="content-area"><div class="content-inner rc-page"><h2 class="h-section">Report Manager</h2><p class="t-lead">Compile the outputs, the Phase 5 pages, and individual ideas into one printed document under one cover: a contents page, a list of what is missing, an introduction you write, and each piece as a numbered section. Add your own text pages wherever a part of the report needs an introduction. A saved report reprints with fresh data. The record itself is never edited here.</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 18px">'+btn('+ New report','rcNew()','bp')+'</div>';
  if(!defs.length)h+=card('<p style="color:var(--text-faint);text-align:center;padding:28px 0">No reports yet. Start one, choose what it contains, and print it.</p>');
  defs.forEach(function(d){var open=ed&&ed.id===d.id;
    h+='<div class="cd" style="margin-bottom:10px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(d.name||'Untitled')+'</div><div style="font-size:12px;color:var(--text-faint)">'+d.units.length+' section'+(d.units.length===1?'':'s')+(d.subtitle?' \u00b7 '+esc(d.subtitle):'')+'</div></div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+rcBtnG('Preview','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG(open?'Close':'Edit','UI.rcEdit='+(open?'null':'\''+d.id+'\'')+';render()','font-size:12px')+rcBtnG('Duplicate','rcDuplicate(\''+d.id+'\')','font-size:12px')+rcBtnG('Delete','rcDelete(\''+d.id+'\')','font-size:12px')+'</span></div>';
    if(open)h+=rcEditor(d);
    h+='</div>'});
  return h+'</div></div>'}
function rcEditor(d){ /* 14 Sep 2026 (Paul's ruling): the Order column is the report's contents being built — one compact row per section with its number, name, kind, a fact about its size, its depth, and a mark where a note is written; one row selected at a time opens the inspector beneath the list, which holds what the section prints, the depth, the note, a preview of that section alone, and for a text page its editor. The Content Options list keeps its size; Add a text page is its first row. */
  var cat=rcCatalogue();var chosen={};d.units.forEach(function(u){chosen[u.key]=1});
  var seg=function(active,label,fn,extra){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(active?'background:rgba(var(--fg-rgb),.10);color:var(--paper);':'')+(extra||'')+'" onclick="'+fn+'">'+label+'</button>'};
  var ico=function(glyph,fn,title,dim){return '<button class="btn-ghost" title="'+esc(title)+'" style="font-size:12px;padding:2px 7px;line-height:1.2;min-width:0;'+(dim?'opacity:.35;pointer-events:none;':'')+'" onclick="event.stopPropagation();'+fn+'">'+glyph+'</button>'};
  var h='<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(var(--fg-rgb),.10)">';
  /* the report's own words: title, subtitle, introduction */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+rcInp('Title','rc_name_'+d.id,d.name,'e.g. Board pack, September')+rcInp('Subtitle','rc_sub_'+d.id,d.subtitle,'One line under the title on the cover')+'</div>';
  h+='<script>document.getElementById(\'rc_name_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'name\',this.value);render()};document.getElementById(\'rc_sub_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'subtitle\',this.value)};</script>';
  h+='<div class="mb-4"><label class="form-label">Introduction</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed after the contents page.</p><textarea rows="6" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSet(\''+d.id+'\',\'intro\',this.value)">'+esc(d.intro||'')+'</textarea></div>';
  /* the toolbar: preview and print; the Save as PDF here matches its neighbours (Paul's ruling, 14 Sep 2026: an exception to the quiet form, because it sits in a block of buttons) */
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 16px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+rcBtnG('Preview the report','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+'<span style="font-size:12px;color:var(--text-faint);margin-left:6px">'+d.units.length+' section'+(d.units.length===1?'':'s')+'</span></div>';
  /* two panes: the sections in order (twice the width) and the content options (its own width) */
  h+='<div class="rc-cols" style="display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:20px;align-items:start">';
  /* left: the contents being built */
  var sel=UI.rcSel!=null?d.units.findIndex(function(u){return u.key===UI.rcSel}):-1;
  h+='<div><h3 class="h-sub-md">Sections, in order</h3>';
  if(!d.units.length)h+='<p class="t-faint-sm" style="padding:14px;border:1px dashed rgba(var(--fg-rgb),.18);border-radius:8px">Nothing chosen yet. Add content from the options on the right. Each section you add appears here as a line of the contents.</p>';
  else{h+='<div style="border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;overflow:hidden">';
    var inspector=function(u,sel){var fact=rcUnitFact(u); /* 14 Sep 2026 (Paul's ruling): the inspector opens directly beneath the selected row, inside the list, so it is never off the page */
      h+='<div style="padding:14px 16px 16px 50px;border-top:1px solid rgba(var(--fg-rgb),.14);background:var(--bg-elev)">';
      h+='<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 6px"><span style="font-family:var(--serif);font-size:22px;line-height:1;color:var(--text-faint)">'+(sel+1)+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(u.kind==='text'?(u.name||'Untitled text page'):u.name)+'</span><span style="font-size:12px;color:var(--text-faint)">'+rcKindLabel(u)+'</span><span style="flex:1"></span>'+(u.kind!=='text'?rcBtnG('Preview this section','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px'):'')+rcBtnG('Close','UI.rcSel=null;render()','font-size:12px')+'</div>';
      if(u.kind==='text'){
        h+='<p class="t-faint-sm" style="margin:0 0 10px">A page you write, printed as its own numbered section. Use it to open a part of the report or to add a page of your own between sections.</p>';
        h+='<input type="text" id="rc_head_'+u.id+'" data-uncapped="1" value="'+esc(u.name||'')+'" placeholder="Heading for this text page" style="width:100%;font-size:15px;font-weight:600;margin:0 0 8px" onchange="rcSetUnit(\''+d.id+'\','+sel+',\'name\',this.value)">';
        h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">'+seg(false,'<b>B</b>','rcFmt(\''+u.id+'\',\'bold\')')+seg(false,'<i>I</i>','rcFmt(\''+u.id+'\',\'italic\')')+'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);align-self:center;margin:0 4px 0 8px">SIZE</span>'+seg(false,'Small','rcFmt(\''+u.id+'\',\'size\',\'small\')')+seg(false,'Normal','rcFmt(\''+u.id+'\',\'size\',\'normal\')')+seg(false,'Large','rcFmt(\''+u.id+'\',\'size\',\'large\')')+seg(false,'Heading','rcFmt(\''+u.id+'\',\'size\',\'heading\')')+'</div>';
        h+='<div id="rc_txt_'+u.id+'" contenteditable="true" class="rc-text-edit" style="min-height:260px;padding:14px 16px;border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;font-size:14px;line-height:1.7;background:rgba(var(--fg-rgb),.02);color:var(--paper);outline:none" oninput="rcSetTextHtml(\''+d.id+'\','+sel+',this.innerHTML)">'+rcSanitize(u.html||'')+'</div>';
        h+='<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0">'+rcBtnS('Save','rcSaveText(\''+d.id+'\','+sel+')','#2A5A5A','font-size:12px')+rcBtnG('Preview this page','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px')+'<span style="font-size:12px;color:var(--text-faint)">Select text, then Bold, Italic, or a size.</span></div>';
      }else{
        h+='<p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 10px">'+esc(rcUnitDesc(u))+(fact?' <span style="color:var(--text-faint)">('+esc(fact)+')</span>':'')+'</p>';
        if(u.depth!==undefined&&u.depth!=='')h+='<div style="margin:0 0 10px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:6px">DEPTH</span>'+seg(u.depth==='summary','Summary','rcSetDepth(\''+d.id+'\','+sel+',\'summary\')')+seg(u.depth==='full','Full','rcSetDepth(\''+d.id+'\','+sel+',\'full\')')+'</div>';
        h+='<label class="form-label">Note for this section</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed at the head of the section.</p><textarea rows="4" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSetNote(\''+d.id+'\','+sel+',this.value);render()">'+esc(u.note||'')+'</textarea>';
      }
      h+='</div>'};
    d.units.forEach(function(u,i){var on=(i===sel);var fact=rcUnitFact(u);var noted=(u.kind==='text')?!!(u.html&&u.html.replace(/<[^>]*>/g,'').trim()):!!(u.note&&u.note.trim());
      h+='<div onclick="UI.rcSel='+(on?'null':'\''+u.key+'\'')+';render()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:'+(i?'1px solid rgba(var(--fg-rgb),.06)':'none')+';'+(on?'background:rgba(var(--fg-rgb),.06)':'')+'">'
        +'<span style="font-family:var(--serif);font-size:17px;line-height:1;color:var(--text-faint);min-width:28px;text-align:right">'+(i+1)+'</span>'
        +'<span style="flex:1;min-width:0;font-size:13.5px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.kind==='text'?'<em style="font-style:normal;font-weight:600">'+esc(u.name||'Untitled text page')+'</em>':'<span style="font-weight:600">'+esc(rcUnitName(u))+'</span>')+'</span>'
        +'<span style="font-size:11px;color:var(--text-faint);white-space:nowrap">'+rcKindLabel(u)+'</span>'
        +(fact?'<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">'+esc(fact)+'</span>':'')
        +(u.depth?'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap">'+u.depth+'</span>':'')
        +'<span title="'+(noted?'A note is written':'No note')+'" style="width:7px;height:7px;border-radius:50%;background:'+(noted?'var(--gold-text)':'rgba(var(--fg-rgb),.15)')+';flex-shrink:0"></span>'
        +'<span style="display:inline-flex;gap:2px;margin-left:4px">'+ico('\u2191','rcMove(\''+d.id+'\','+i+',-1)','Move up',i===0)+ico('\u2193','rcMove(\''+d.id+'\','+i+',1)','Move down',i===d.units.length-1)+ico('\u00d7','rcRemoveAt(\''+d.id+'\','+i+')','Remove this section')+'</span></div>';
      if(i===sel)inspector(u,i)});
    h+='</div>';
  }
  h+='</div>';
  /* right: report content options */
  h+='<div><h3 class="h-sub-md">Report Content Options</h3>';
  var groups=[];var byG={};cat.forEach(function(u){if(!byG[u.group]){byG[u.group]=[];groups.push(u.group)}byG[u.group].push(u)});
  var row=function(u){var k=rcKey(u);var on=!!chosen[k];
    return '<div class="rc-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px"><span style="flex:1;min-width:0;color:'+(on?'var(--text-faint)':'var(--paper)')+'">'+(on?'\u2713 ':'')+esc(u.name)+(u.sub?' <span style="font-size:11px;color:var(--text-faint)">'+esc(u.sub)+'</span>':'')+'</span>'
      +(on?seg(false,'Remove','rcToggle(\''+d.id+'\',\''+k+'\')'):(u.depths?(seg(false,'Summary','rcToggle(\''+d.id+'\',\''+k+'\',\'summary\')')+seg(false,'Full','rcToggle(\''+d.id+'\',\''+k+'\',\'full\')')):seg(false,'Add','rcToggle(\''+d.id+'\',\''+k+'\')')))+'</div>'};
  /* the first option: a text page */
  h+='<div style="margin:0 0 14px"><div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:8px;font-size:13px"><span style="flex:1;min-width:0"><span style="font-weight:600;color:var(--paper)">Text page</span> <span style="font-size:11px;color:var(--text-faint)">A heading and a body you write, added after the selected section or at the end</span></span>'+seg(false,'Add','rcAddText(\''+d.id+'\','+(sel>=0?(sel+1):'null')+')')+'</div></div>';
  groups.forEach(function(g){var list=byG[g];
    h+='<div style="margin:0 0 14px"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:0 0 4px;border-bottom:1px solid rgba(var(--fg-rgb),.18);margin:0 0 2px;display:flex;align-items:baseline;gap:8px">'+esc(g)+'<span style="font-family:var(--sans);letter-spacing:0;text-transform:none;font-size:11px;color:var(--text-faint)">'+list.length+'</span></div>';
    if(g==='Individual Ideas'){var F=rcLeaderFilter();
      h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px"><input type="search" placeholder="Search ideas by name or department" value="'+esc(F.q)+'" style="flex:1;min-width:160px;font-size:12px;padding:4px 8px" oninput="rcSetFilter(\'q\',this.value)"></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:0 0 6px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">STAGE</span>'+[['all','All'],['Blue Sky','Blue Sky'],['Exploration','Exploration'],['No-Go','No-Go'],['Development','Development'],['Operational','Operational']].map(function(x){return seg(F.st===x[0],x[1],'rcSetFilter(\'st\',\''+x[0]+'\')')}).join('')+'</div>';
      var shown=list.filter(function(u){return rcLeaderPasses(u.rec,F)});
      h+='<div style="font-size:11px;color:var(--text-faint);margin:0 0 2px">'+shown.length+' of '+list.length+' idea'+(list.length===1?'':'s')+(shown.length!==list.length?' shown':'')+'</div>';
      if(!shown.length)h+='<p class="t-faint-sm" style="padding:8px 0">No idea matches these filters.</p>';
      shown.forEach(function(u){h+=row(u)});
    }else list.forEach(function(u){h+=row(u)});
    h+='</div>'});
  h+='</div></div>';
  return h+'</div>'}