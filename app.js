(() => {
  'use strict';
  const D = window.ECO_DATA;
  const S = {...(D.archivedSources || {}), ...D.sources};
  const allCases = [...D.cases, ...(D.archivedCases || [])];
  const main = document.getElementById('main');
  const modal = document.getElementById('modal');
  const storageKey = 'busan-eco-explorer-v1';
  const caseIds = new Set(allCases.map(c => c.id));
  const allFacts = allCases.flatMap(c => c.facts.map(f => ({ ...f, caseId: c.id })));
  const factIds = new Set(allFacts.map(f => f.id));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const findCase = id => allCases.find(c => c.id === id);
  const findFact = id => allFacts.find(f => f.id === id);
  const textValue = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
  const unique = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(id => allowed.has(id)))] : [];
  function normalize(value) {
    const v = value && typeof value === 'object' ? value : {};
    const facts = unique(v.facts, factIds);
    const candidates = unique([...(Array.isArray(v.candidates) ? v.candidates : []), ...facts.map(id => findFact(id).caseId)], caseIds);
    return {version:1,candidates,facts,selected:candidates.includes(v.selected) ? v.selected : '',name:textValue(v.name,35),problem:textValue(v.problem,240),question:textValue(v.question,320),ecoNote:textValue(v.ecoNote,240),peopleNote:textValue(v.peopleNote,240),target:textValue(v.target,120),notes:Object.fromEntries(facts.map(id => [id,textValue(v.notes?.[id],300)])),read:unique(v.read,caseIds),large:v.large===true};
  }
  let state = normalize({});
  let storageAvailable = true;
  try { state = normalize(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { storageAvailable = false; }
  let filter = '전체', search = '', toastTimer, lastFocus, pendingImport;
  let compareA = '', compareB = '', homePage = 0;
  const paths = {
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>', back:'<path d="M19 12H5m5-5-5 5 5 5"/>',
    leaf:'<path d="M5 19C1 7 10 2 20 4c1 11-5 18-15 15Z"/><path d="m5 19 10-10m-6 6 6 1"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    bookmark:'<path d="M6 4h12v17l-6-4-6 4V4Z"/>',check:'<path d="m5 12 4 4L19 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',basket:'<path d="m4 10 2 11h12l2-11H4Zm4 0 4-7 4 7M9 14v3m6-3v3"/>',
    book:'<path d="M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2V4Zm9 2v15"/>',
    users:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    external:'<path d="M14 3h7v7m0-7L11 13m-1-9H4v16h16v-6"/>',
    print:'<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6v-7Z"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-1 1-1.9 1-1.9 3M12 17h.01"/>',
    reset:'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
    zoom:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`; }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    document.getElementById('save-status').textContent = storageAvailable ? '이 기기에 자동 저장' : '자동 저장 불가 · 바구니를 내려받으세요';
  }
  function toast(message) {
    const box = document.getElementById('toast'); box.textContent = message; box.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 2600);
  }
  function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  function route() {
    const params = new URLSearchParams(location.hash.slice(1));
    const integer = (key, fallback, min, max) => {
      const n = Number(params.get(key));
      return params.has(key) && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
    };
    if (params.get('view') === 'notebook') return {view:'notebook',step:integer('step',1,1,4),fact:params.get('fact')};
    const c = findCase(params.get('case'));
    return c ? {view:'case',c,tab:['evidence','science','think'].includes(params.get('tab'))?params.get('tab'):'evidence',reading:params.get('read'),page:integer('page',0,0,100)} : {view:'explore'};
  }
  function updateUI() {
    document.getElementById('basket-count').textContent = state.candidates.length;
    document.body.classList.toggle('large-font', state.large);
    document.querySelector('[data-action="font"]').setAttribute('aria-pressed', String(state.large));
    document.querySelectorAll('[data-action="candidate"]').forEach(button => {
      if(button.classList.contains('remove-button'))return;
      const saved = state.candidates.includes(button.dataset.case);
      button.classList.toggle('is-saved', saved); button.setAttribute('aria-pressed', String(saved));
      if (button.classList.contains('card-bookmark')) { button.innerHTML = icon(saved?'check':'bookmark'); button.setAttribute('aria-label', `${findCase(button.dataset.case).short} ${saved?'담기 취소':'문제 후보에 담기'}`); }
      else { button.innerHTML = icon(saved?'check':'bookmark') + (saved?'주제 담음':'문제 후보에 담기'); }
    });
    document.querySelectorAll('[data-action="fact"]').forEach(button => {
      const saved = state.facts.includes(button.dataset.fact); button.classList.toggle('is-saved', saved);
      button.setAttribute('aria-pressed',String(saved)); button.innerHTML = icon(saved?'check':'plus') + (saved?'근거 담음':'근거 담기');
    });
    document.getElementById('save-status').textContent = storageAvailable ? '이 기기에 자동 저장' : '자동 저장 불가 · 바구니를 내려받으세요';
  }
  function card(c) {
    const focus = {toads:['주민의 길 이용','먹이와 이동길'],birds:['사람의 공원 이용','새의 먹이와 쉼터'],litter:['바다의 이용과 관리','생물의 몸과 사는 곳']}[c.id];
    return `<article class="case-card ${c.color}">
      <button class="card-open" data-action="case" data-case="${c.id}" aria-label="${esc(c.short)} 살펴보기">
        <div class="card-photo"><img src="${c.image}" alt="${esc(c.photoAlt)}" loading="lazy"><span class="card-no">${c.no}</span><span class="photo-habitat">${c.category} 생태계</span></div>
        <div class="card-body"><div class="card-location">${icon('pin')}${esc(c.place)}</div><h2>${esc(c.title)}</h2><p class="card-hook">${esc(c.hook)}</p>
        <div class="card-connections"><p><span>우리 동네</span>${esc(focus?.[0] || c.projectFocus.region)}</p><p><span>생태계</span>${esc(focus?.[1] || c.projectFocus.ecosystem)}</p></div></div>
      </button>
      <button class="card-bookmark" data-action="candidate" data-case="${c.id}" aria-label="${esc(c.short)} 문제 후보에 담기">${icon('bookmark')}</button>
      <div class="card-bottom"><span class="material-total">${icon('book')}읽기 자료 ${c.facts.length}개</span><button class="card-start" data-action="case" data-case="${c.id}" aria-label="${esc(c.short)} 자료 읽기">자료 읽기 ↗</button></div>
    </article>`;
  }
  function filteredCases() {
    const q = search.trim().toLocaleLowerCase();
    return D.cases.filter(c => (filter==='전체'||c.category===filter) && (!q||[c.title,c.short,c.place,c.hook,...c.tags].join(' ').toLocaleLowerCase().includes(q)));
  }

  function refreshGrid() {
    const matches = filteredCases();
    const single = window.matchMedia('(max-width:899px)').matches;
    homePage = Math.max(0, Math.min(homePage, matches.length-1));
    const visible = single ? matches.slice(homePage,homePage+1) : matches;
    document.getElementById('case-grid').innerHTML = matches.length ? visible.map(card).join('') : `<div class="empty-state no-results">${icon('search')}<h2>해당하는 주제가 없어요</h2><p>다른 낱말로 검색하거나 전체 주제를 살펴보세요.</p><button class="secondary-button" data-action="clear-search">전체 주제 보기</button></div>`;
    document.getElementById('result-total').textContent = matches.length;
    const pager = document.getElementById('home-pager');
    pager.hidden = !single || matches.length < 2;
    pager.innerHTML = `<button class="subtle-button" data-action="home-page" data-dir="-1" ${homePage===0?'disabled':''}>${icon('back')}앞 주제</button><span>주제 ${homePage+1} / ${matches.length}</span><button class="subtle-button" data-action="home-page" data-dir="1" ${homePage>=matches.length-1?'disabled':''}>다음 주제${icon('arrow')}</button>`;
    document.querySelectorAll('[data-action="filter"]').forEach(b => { b.classList.toggle('active',b.dataset.filter===filter); b.setAttribute('aria-pressed',String(b.dataset.filter===filter)); });
    updateUI();
  }
  function explore() {
    main.classList.add('home-view');
    main.innerHTML = `<section class="hero" aria-labelledby="explore-title"><div><div class="eyebrow">사회 × 과학 · 함께 살아가는 부산</div><h1 id="explore-title">우리 동네의 문제를,<br><em>사람과 생물의 눈으로.</em></h1><p>세 가지 주제의 자료를 깊이 읽고, 우리 모둠의 제안을 준비해요.</p></div><div class="journey" aria-label="탐구 순서"><div class="journey-step"><b>1</b>자료 읽기</div><span class="journey-arrow" aria-hidden="true">→</span><div class="journey-step"><b>2</b>함께 생각</div><span class="journey-arrow" aria-hidden="true">→</span><div class="journey-step"><b>3</b>문제 고르기</div></div></section>
      <section aria-label="생태 문제 탐색"><div class="explore-toolbar"><div class="filters" role="group" aria-label="생태계 종류로 찾기">${['전체',...new Set(D.cases.map(c=>c.category))].map(f=>`<button class="filter ${f===filter?'active':''}" data-action="filter" data-filter="${f}" aria-pressed="${f===filter}">${f}</button>`).join('')}</div><span class="result-count">살펴볼 주제 <b id="result-total">${D.cases.length}</b>개 · 읽기 자료 ${D.cases.reduce((n,c)=>n+c.facts.length,0)}개</span><label class="search-field">${icon('search')}<input id="case-search" aria-label="장소나 생물 검색" placeholder="장소나 생물로 찾아요" value="${esc(search)}" maxlength="60" type="search"></label></div><div id="case-grid" class="case-grid" aria-live="polite"></div><nav id="home-pager" class="home-pager" aria-label="주제 앞뒤 이동" hidden></nav></section>
      <aside class="shared-topic-note">${icon('users')}<div><strong>같은 주제도 괜찮아요.</strong><span>제안할 대상과 방법은 모둠마다 달라질 수 있어요.</span></div></aside>
      <div class="home-word-row"><span>수업에서 쓰는 말</span>${D.glossary.map((w,i)=>`<button class="word-button" data-action="common-word" data-word="${i}">${esc(w[0])} +</button>`).join('')}<button class="text-button" data-action="sources">원문과 자료 출처 ↗</button></div>`;
    refreshGrid();
  }
  function sourceLink(id, label) {
    const s = S[id];
    return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(label||s.org)} ↗<span class="sr-only"> 새 창</span></a>`;
  }
  function legacyFactsView(c) {
    return `<section class="story-top"><figure class="story-photo"><button class="photo-zoom" data-action="photo" data-case="${c.id}" aria-label="${esc(c.photoLabel)} 크게 보기"><img src="${c.image}" alt="${esc(c.photoAlt)}"><span class="zoom-label">${icon('zoom')}사진 크게</span></button><figcaption>${esc(c.photoLabel)}</figcaption></figure><div class="story-copy"><div class="eyebrow">${esc(c.eyebrow)}</div><h2>${esc(c.hook)}</h2><p>${esc(c.intro)}</p><div class="context-note">${esc(c.context)}</div></div></section>
      <div class="section-label">${icon('book')}자료를 읽으며 단서를 찾아요</div><section class="facts-grid" aria-label="읽기 자료">${c.facts.map((f,i)=>{
      const s=S[f.source]; return `<article class="fact-card"><div class="fact-number">자료 ${i+1}${f.analysis?'<span class="analysis-tag">해석할 때 주의</span>':''}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><a class="fact-source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.org)} · ${esc(s.date)} ↗</a><div class="fact-bottom"><button class="text-button" data-action="source-one" data-source="${f.source}">출처 자세히</button><button class="evidence-save" data-action="fact" data-fact="${f.id}">${icon('plus')}근거 담기</button></div></article>`;
    }).join('')}</section>`;
  }
  function readingFigure(f) {
    if(f.display==='marine-chart')return `<details class="reading-figure"><summary>숫자 자료를 그래프와 표로 보기</summary>${barChart([[2023,1556],[2024,1394],[2025,850]],'톤')}</details>`;
    if(f.display==='toad-counts')return `<details class="reading-figure"><summary>조사한 숫자를 표로 보기</summary><table><caption>조사 대상 50마리 · 온천천의 전체 두꺼비 수는 아니에요.</caption><thead><tr><th scope="col">조사에서 확인한 일</th><th scope="col">마릿수</th></tr></thead><tbody><tr><th scope="row">살아남은 것으로 확인</th><td>30마리</td></tr><tr><th scope="row">길에서 사고로 목숨을 잃음</th><td>20마리</td></tr></tbody></table><p>온천천의 모든 두꺼비 수를 센 표는 아니에요.</p></details>`;
    return '';
  }

  function chunkReading(text, limit) {
    const result=[];
    let current='';
    const sentences = String(text).trim().match(/[^.!?]+[.!?]*/gu) || [String(text)];
    const add = part => {
      const combined = current ? current+' '+part : part;
      if (combined.length > limit && current) { result.push(current); current=part; }
      else current=combined;
    };
    for (const sentence of sentences) {
      const part=sentence.trim();
      if(part.length<=limit)add(part);
      else for(const word of part.split(/\s+/u))add(word);
    }
    if(current)result.push(current);
    return result;
  }
  function readingPages(f) {
    const font=state.large?28:24;
    const lineWidth=Math.max(220,window.innerWidth-92);
    const available=Math.max(110,window.innerHeight-510);
    const lines=Math.max(2,Math.floor((available-16)/(font*1.7)));
    const limit=window.innerWidth<700?160:Math.max(90,Math.min(480,Math.floor(lines*Math.floor(lineWidth/font)*.9)));
    const segments=f.paragraphs.flatMap((text,i)=>chunkReading(text,limit).map(part=>({text:part,paragraph:i+1})));
    const pages=[];let parts=[],length=0;
    const flush=()=>{if(parts.length)pages.push({kind:'text',text:parts.map(p=>p.text).join(' '),parts});parts=[];length=0;};
    for(const segment of segments){if(parts.length&&length+segment.text.length+1>limit)flush();parts.push(segment);length+=segment.text.length+1;}
    flush();
    if(f.display)pages.push({kind:'figure'});
    pages.push({kind:'questions'});
    return pages;
  }
  function pageFigure(f) {
    if(f.display==='marine-chart')return `<div class="page-figure"><div class="chart-unit">부산항에서 주운 양 · 단위: 톤 (바다 전체의 쓰레기 양은 아니에요)</div><div class="chart" role="img" aria-label="2023년 1556톤, 2024년 1394톤, 2025년 850톤">${[[2023,1556],[2024,1394],[2025,850]].map(r=>`<div class="chart-row"><span class="chart-year">${r[0]}년</span><div class="bar-track"><div class="chart-bar" style="width:${r[1]/1556*100}%"></div><span class="bar-value">${r[1].toLocaleString('ko-KR')}</span></div></div>`).join('')}</div><button class="text-button" data-action="number-table" data-fact="${f.id}">숫자 표 크게 보기</button></div>`;
    return `<div class="page-figure"><table class="number-table"><caption>조사 대상 50마리 · 온천천의 전체 두꺼비 수는 아니에요.</caption><thead><tr><th scope="col">조사에서 확인한 일</th><th scope="col">마릿수</th></tr></thead><tbody><tr><th scope="row">살아남은 것으로 확인</th><td>30마리</td></tr><tr><th scope="row">길에서 사고로 목숨을 잃음</th><td>20마리</td></tr></tbody></table></div>`;
  }
  function factsView(c,readingId,pageIndex=0) {
    if(!c.facts[0]?.paragraphs)return legacyFactsView(c);
    const f=c.facts.find(f=>f.id===readingId)||c.facts[0],index=c.facts.indexOf(f),src=S[f.source];
    const pages=readingPages(f), page=Math.min(pageIndex,pages.length-1), current=pages[page];
    let content;
    if(current.kind==='text')content=`<div class="reading-prose">${current.parts.map(p=>`<p>${esc(p.text)}</p>`).join('')}</div>`;
    else if(current.kind==='figure')content=pageFigure(f);
    else content=`<div class="reading-questions"><div><span>자료에서 찾기</span><p>${esc(f.findQuestion)}</p></div><div><span>함께 생각하기</span><p>${esc(f.connectQuestion)}</p></div></div>`;
    return `<section class="reading-workspace" aria-label="주제별 읽기 자료"><div class="reading-selector"><label for="reading-select">읽을 자료</label><select class="form-field" id="reading-select" data-case="${c.id}">${c.facts.map((item,i)=>`<option value="${item.id}" ${item.id===f.id?'selected':''}>${String(i+1).padStart(2,'0')}. ${esc(item.title)}</option>`).join('')}</select><button class="secondary-button" data-action="reading-list" data-case="${c.id}">목록 ${c.facts.length}개</button><button class="secondary-button photo-shortcut" data-action="photo" data-case="${c.id}">${icon('zoom')}사진</button></div><article class="reading-paper paged-paper" aria-labelledby="reading-title"><header class="reading-paper-head"><div class="reading-kicker"><span>${esc(f.lens)}</span><small class="reading-source-meta">${esc(src.date)}</small><small>자료 ${index+1} / ${c.facts.length}</small></div><h2 id="reading-title">${esc(f.title)}</h2></header><div class="reading-window" aria-live="polite" tabindex="0" aria-label="${current.kind==='questions'?'자료의 질문':current.kind==='figure'?'숫자 자료':`읽기 ${page+1}쪽`}">${content}</div><div class="reading-dock"><div class="reading-tools"><button class="text-button" data-action="source-one" data-source="${f.source}">출처·원문</button><button class="evidence-save" data-action="fact" data-fact="${f.id}">${icon('plus')}근거 담기</button></div><nav class="page-controls" aria-label="읽기 쪽 넘기기"><button class="subtle-button" data-action="reading-page" data-dir="-1" ${page===0&&index===0?'disabled':''}>${icon('back')}${page===0&&index>0?'앞 자료':'앞 쪽'}</button><span class="page-count">${page+1} / ${pages.length}쪽</span><button class="primary-button" data-action="reading-page" data-dir="1" ${page===pages.length-1&&index===c.facts.length-1?'disabled':''}>${page===pages.length-1?(index===c.facts.length-1?'읽기 끝':'다음 자료'):'다음 쪽'}${icon('arrow')}</button></nav></div></article></section>`;
  }
  function moveReading(direction) {
    const r=route();if(r.view!=='case'||r.tab!=='evidence'||!r.c.facts[0]?.paragraphs)return;
    const c=r.c,f=c.facts.find(f=>f.id===r.reading)||c.facts[0],index=c.facts.indexOf(f),pages=readingPages(f);
    let page=Math.min(r.page,pages.length-1)+direction, next=f;
    if(page<0){if(index===0)return;next=c.facts[index-1];page=readingPages(next).length-1;}
    if(page>=pages.length&&next===f){if(index===c.facts.length-1)return;next=c.facts[index+1];page=0;}
    navigate(`#case=${c.id}&tab=evidence&read=${next.id}&page=${page}`);
  }
  function readingList(c) {
    showModal('읽을 자료 고르기',`<div class="reading-list-grid">${c.facts.map((f,i)=>`<button class="reading-choice" data-action="reading" data-case="${c.id}" data-read="${f.id}"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(f.title)}</strong>${state.facts.includes(f.id)?'<b class="reading-saved" aria-label="근거 담음">✓</b>':''}</button>`).join('')}</div>`);
  }
  function barChart(rows,unit) {
    const max=Math.max(...rows.map(r=>r[1]));
    return `<div class="chart-unit">단위: ${unit}</div><div class="chart" role="img" aria-label="${rows.map(r=>`${r[0]}년 ${r[1].toLocaleString('ko-KR')}${unit}`).join(', ')}">${rows.map(r=>`<div class="chart-row"><span class="chart-year">${r[0]}년</span><div class="bar-track"><div class="chart-bar" style="width:${(r[1]/max*100).toFixed(2)}%"></div><span class="bar-value">${r[1].toLocaleString('ko-KR')}</span></div></div>`).join('')}</div><details class="chart-table"><summary>숫자를 표로 보기</summary><table><caption>연도별 비교 자료</caption><thead><tr><th scope="col">연도</th><th scope="col">값(${unit})</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${r[0]}년</th><td>${r[1].toLocaleString('ko-KR')}</td></tr>`).join('')}</tbody></table></details>`;
  }
  function visual(c) {
    if(c.visual==='marine-chart') return barChart([[2023,1556],[2024,1394],[2025,850]],'톤') + '<div class="chart-caution">주운 양이 적어졌다고 쓰레기가 적게 생겼다고 말할 수 있을까요?</div>';
    if(c.visual==='plant-chart') return barChart([[2021,741092],[2024,241396]],'㎡') + '<div class="chart-caution">양미역취 한 종류의 조사 결과예요. 모든 식물의 변화를 뜻하지는 않아요.</div>';
    if(c.visual==='food-web') return '<div class="food-rows"><div class="food-row"><div class="food-organism"><span aria-hidden="true">🦀</span><b>칠게</b><small>갯벌에서 살아가요</small></div><span class="food-arrow" aria-label="먹이가 됨">→</span><div class="food-organism"><span aria-hidden="true">🐦</span><b>마도요 같은 새</b><small>칠게를 먹어요</small></div></div><div class="food-row"><div class="food-organism"><span aria-hidden="true">🌱</span><b>물가의 풀</b><small>새섬매자기의 뿌리가 먹이가 돼요</small></div><span class="food-arrow" aria-label="먹이가 됨">→</span><div class="food-organism"><span aria-hidden="true">🦢</span><b>고니</b><small>겨울의 먹이를 구해요</small></div></div></div>';
    if(c.visual==='toad-route') return `<svg class="diagram" viewBox="0 0 500 250" role="img" aria-label="연못과 육지 서식 공간 사이로 산책로가 지나가는 개념 그림"><rect x="10" y="18" width="480" height="210" rx="22" fill="#dbe8c7"/><ellipse cx="111" cy="124" rx="75" ry="56" fill="#acd3d1"/><ellipse cx="104" cy="116" rx="57" ry="38" fill="#bde1dc"/><path d="M219 18h64v210h-64Z" fill="#ded7be"/><path d="M251 22v199" stroke="#fff" stroke-width="3" stroke-dasharray="8 9"/><path d="M358 167q-14-35 6-59 17 9 14 31 17-44 37-42 14 24-3 47 30-25 42-11 0 32-39 42" fill="#91b267"/><path d="M158 140h183" fill="none" stroke="#486c34" stroke-width="3" stroke-dasharray="7 6"/><path d="m325 131 18 9-18 9" stroke="#486c34" stroke-width="3" fill="none"/><g transform="translate(183 119)"><ellipse cx="0" cy="0" rx="14" ry="10" fill="#648c43"/><circle cx="12" cy="-4" r="7" fill="#749b50"/><circle cx="14" cy="-7" r="2" fill="#273c1e"/><path d="m-11 4-8 8 11-2M0 7l-2 9 10-9" fill="none" stroke="#648c43" stroke-width="4" stroke-linecap="round"/></g><text x="110" y="53" text-anchor="middle" font-size="18" font-weight="700">연못</text><text x="251" y="53" text-anchor="middle" font-size="14">사람의 길</text><text x="390" y="53" text-anchor="middle" font-size="18" font-weight="700">땅에서 사는 곳</text><text x="110" y="203" text-anchor="middle" font-size="13">알을 낳고 자라는 곳</text><text x="389" y="203" text-anchor="middle" font-size="13">먹이를 찾고 숨는 곳</text></svg><p class="diagram-question">어디에서 두꺼비와 사람이 만날까요?</p>`;
    if(c.visual==='water-path') return `<svg class="diagram" viewBox="0 0 500 250" role="img" aria-label="하천의 물과 물속 산소, 물고기의 생활을 나타낸 개념 그림"><rect x="10" y="70" width="480" height="155" rx="18" fill="#b7d9df"/><path d="M10 90q60-25 120 0t120 0t120 0t120 0" stroke="#eaf5f5" stroke-width="5" fill="none"/><path d="m82 20 15 25H67Z" fill="#8babb6"/><path d="m126 28 12 22h-24Z" fill="#8babb6"/><text x="319" y="41" text-anchor="middle" font-size="17">물속에도 산소가 있어요</text><g fill="#ebfafb" stroke="#6d9caa" stroke-width="2"><circle cx="120" cy="140" r="14"/><circle cx="156" cy="177" r="9"/><circle cx="185" cy="116" r="11"/><circle cx="349" cy="120" r="12"/></g><g transform="translate(288 168)"><ellipse rx="44" ry="23" fill="#578e95"/><path d="m35 0 28-25v50Z" fill="#578e95"/><circle cx="-25" cy="-5" r="4" fill="#203e40"/><path d="M-1-21 13-37l7 20" fill="#578e95"/></g><text x="113" y="212" font-size="14">산소</text><text x="242" y="212" font-size="14">물고기의 호흡</text></svg><p class="diagram-question">물의 양과 물속 산소는 같은 뜻일까요?</p>`;
    return `<div class="glass-scene" id="glass-scene"><svg class="diagram" viewBox="0 0 500 250" role="img" aria-label="나무 풍경이 비치는 유리창. 버튼으로 무늬를 보이거나 숨길 수 있습니다."><rect x="15" y="12" width="470" height="215" rx="17" fill="#d9e8d0"/><path d="M16 163q100-45 200 5t270-10v69H16Z" fill="#9fbb87"/><path d="M99 153V83m40 70V76m210 76V84" stroke="#6d8462" stroke-width="10"/><g fill="#9cbc81"><circle cx="99" cy="63" r="30"/><circle cx="139" cy="57" r="30"/><circle cx="349" cy="62" r="32"/></g><rect x="192" y="31" width="126" height="171" fill="#deeff0" fill-opacity=".46" stroke="#738b89" stroke-width="6"/><path d="m208 65 45-24m-45 51 60-33" stroke="#fff" stroke-opacity=".6" stroke-width="5"/><g class="glass-dots" fill="#315e53">${Array.from({length:8},(_,r)=>Array.from({length:5},(_,col)=>`<circle cx="${207+col*24}" cy="${47+r*20}" r="3.5"/>`).join('')).join('')}</g><path d="m377 100 12-9 14 12 17-5-12 13-14 2-17-13Z" fill="#50785c"/><text x="85" y="205" font-size="14">주변 나무</text><text x="250" y="222" text-anchor="middle" font-size="14">유리창</text></svg></div><div class="diagram-controls"><button class="secondary-button" data-action="glass" aria-pressed="false">${icon('plus')}유리창에 무늬 보이기</button></div>`;
  }

  function scienceView(c) {
    let picture=visual(c);
    if(c.visual==='marine-chart')picture=picture.replace(/<details class="chart-table">[\s\S]*?<\/details>/,'<button class="text-button science-number-table" data-action="number-table">숫자 표 크게 보기</button>');
    return `<div class="science-layout compact-science"><section class="surface"><h2>${esc(c.visualTitle)}</h2><div class="visual-box">${picture}</div><div class="visual-note">${esc(c.visualNote)}</div>${c.extraSource?`<p class="additional-reading">더 살펴볼 자료: ${sourceLink(c.extraSource,'경보가 있어도 폐사가 없었던 사례')}</p>`:''}</section><section class="surface"><h2>어떤 관계가 있을까요?</h2><div class="thinking-question">${esc(c.science.question)}</div><div class="science-actions"><button class="secondary-button" data-action="science-detail" data-case="${c.id}" data-part="nodes">생각한 뒤, 관계 짚어 보기</button><button class="secondary-button" data-action="science-detail" data-case="${c.id}" data-part="connection">배운 과학과 연결하기</button></div><div class="glossary">${c.words.map((w,i)=>`<button class="word-button" data-action="word" data-case="${c.id}" data-word="${i}">${esc(w[0])} +</button>`).join('')}</div></section></div>`;
  }

  function thinkView(c) {
    return `<div class="think-workspace"><p class="voice-notice">입장을 생각해 보도록 만든 카드예요. 실제 인터뷰는 아니에요.</p><section class="voices-grid">${c.voices.map((v,i)=>`<article class="voice-card"><div class="voice-icon">${icon(i===2?'leaf':'users')}</div><h3>${esc(v.who)}</h3><p>${esc(v.view)}</p></article>`).join('')}</section><section class="think-prompt"><h2>누구에게 무엇이 필요할까요?</h2><p>사람과 생물의 생활을 함께 생각해요.</p><div class="button-row"><button class="secondary-button" data-action="think-questions" data-case="${c.id}">모둠 토의 질문 ${c.questions.length}개</button><button class="primary-button" data-action="notebook">${icon('basket')}바구니에서 정리하기</button></div></section></div>`;
  }

  function caseView(c,tab,readingId,pageIndex=0) {
    if(!state.read.includes(c.id)){state.read.push(c.id);save();}
    const tabs=[['evidence','자료 읽기'],['science','생태계 연결'],['think','사람과 함께 생각']];
    main.innerHTML=`<header class="case-toolbar"><button class="back-button" data-action="home" aria-label="다른 주제 살펴보기">${icon('back')}다른 주제</button><div class="case-title"><span>${esc(c.place)}${c.archived?' · 이전판 자료':''}</span><h1>${esc(c.short)}</h1></div><button class="secondary-button" data-action="candidate" data-case="${c.id}">${icon('bookmark')}문제 후보에 담기</button></header><nav class="detail-tabs" aria-label="이 주제 탐구 단계">${tabs.map((t,i)=>`<button class="detail-tab ${tab===t[0]?'active':''}" data-action="tab" data-case="${c.id}" data-tab="${t[0]}" ${tab===t[0]?'aria-current="page"':''}><span>${i+1}</span>${t[1]}</button>`).join('')}<button class="text-button case-source-shortcut" data-action="case-sources" data-case="${c.id}">출처 모아보기</button></nav><div class="detail-content">${tab==='science'?scienceView(c):tab==='think'?thinkView(c):factsView(c,readingId,pageIndex)}</div>`;
  }

  function notebook() {
    const r=route(),step=r.view==='notebook'?r.step:1;
    const steps=['주제와 근거','발견한 문제','생물과 사람','제안과 저장'];
    const f=findFact(state.facts.includes(r.fact)?r.fact:state.facts[0]),factIndex=f?state.facts.indexOf(f.id):-1;
    let content='';
    if(step===1){
      content=`<section class="topic-pick"><label class="field-label" for="chosen-case">이번에 탐구할 주제</label><div class="topic-pick-row"><select class="form-field" name="chosen-case" id="chosen-case"><option value="">아직 고르지 않았어요</option>${state.candidates.map(id=>`<option value="${id}" ${state.selected===id?'selected':''}>${esc(findCase(id).short)}</option>`).join('')}</select><button class="secondary-button" data-action="candidate-list">후보 ${state.candidates.length}개 보기</button>${state.candidates.length>1?'<button class="secondary-button" data-action="compare">두 주제 비교</button>':''}</div></section>`;
      if(f){const c=findCase(f.caseId),source=S[f.source];content+=`<section class="saved-evidence"><div class="evidence-pick-row"><label class="field-label" for="saved-fact-select">담은 근거 ${state.facts.length}개</label><select class="form-field" id="saved-fact-select">${state.facts.map((id,i)=>`<option value="${id}" ${id===f.id?'selected':''}>${i+1}. ${esc(findFact(id).title)}</option>`).join('')}</select><button class="remove-button" data-action="remove-fact" data-fact="${f.id}" aria-label="${esc(f.title)} 근거 빼기">×</button></div><div class="evidence-summary"><span class="source-topic">${esc(c.short)}</span><p>${esc(f.text)}</p><button class="text-button" data-action="source-one" data-source="${f.source}">${esc(source.org)} · 출처 보기</button></div><label class="field-label note-label" for="note-${f.id}">이 근거에서 내가 주목한 점</label><textarea id="note-${f.id}" class="form-field evidence-note" data-note="${f.id}" maxlength="300" placeholder="자료에서 무엇을 찾았나요?">${esc(state.notes[f.id])}</textarea><nav class="evidence-pager" aria-label="담은 근거 앞뒤 이동"><button class="text-button" data-action="saved-fact-page" data-dir="-1" ${factIndex===0?'disabled':''}>앞 근거</button><span>${factIndex+1} / ${state.facts.length}</span><button class="text-button" data-action="saved-fact-page" data-dir="1" ${factIndex===state.facts.length-1?'disabled':''}>다음 근거</button><a href="#case=${c.id}&tab=evidence&read=${f.id}">자료 다시 읽기 ↗</a></nav></section>`;}
      else content+=`<div class="notebook-empty"><h2>관심 있는 자료를 담아 보세요.</h2><p>읽기 화면의 ‘근거 담기’를 누르면 여기에 모여요.</p><button class="primary-button" data-action="home">자료 찾아보기${icon('arrow')}</button></div>`;
    }
    if(step===2)content=`<section class="problem-step"><div class="name-line"><label class="field-label" for="group-name">이름 또는 모둠 <small>선택</small></label><input class="form-field" id="group-name" data-field="name" maxlength="35" placeholder="예: 3모둠" value="${esc(state.name)}"></div><label class="field-label" for="problem-note">우리가 발견한 문제</label><p class="field-help">어디에서, 어떤 생물이나 환경에, 무슨 일이 생기나요?</p><textarea class="form-field problem-field" id="problem-note" data-field="problem" maxlength="240" placeholder="자료에서 확인한 사실과 우리 생각을 구분해 적어요.">${esc(state.problem)}</textarea><div class="field-counter" data-counter="problem">${state.problem.length}/240</div></section>`;
    if(step===3)content=`<div class="notebook-bridge pair-step"><section><label class="field-label" for="eco-note">생물의 생활에는 어떤 일이 생기나요?</label><p class="field-help">먹이, 이동, 숨을 곳, 물과 땅의 변화를 생각해요.</p><textarea class="form-field compact-field" id="eco-note" data-field="ecoNote" maxlength="240" placeholder="어떤 생물의 어떤 생활과 연결되나요?">${esc(state.ecoNote)}</textarea></section><section><label class="field-label" for="people-note">이곳의 사람들에게는 무엇이 필요한가요?</label><p class="field-help">주민, 이용자, 관리하는 사람을 함께 생각해요.</p><textarea class="form-field compact-field" id="people-note" data-field="peopleNote" maxlength="240" placeholder="사람들에게 필요한 것은 무엇인가요?">${esc(state.peopleNote)}</textarea></section></div>`;
    if(step===4)content=`<div class="final-note-grid"><section><label class="field-label" for="target-note">누구에게 제안하고 싶나요?</label><input class="form-field" id="target-note" data-field="target" maxlength="120" placeholder="친구, 공원 이용자, 구청 등" value="${esc(state.target)}"><label class="field-label" for="question-note">더 알아보고 싶은 점</label><textarea class="form-field question-field" id="question-note" data-field="question" maxlength="320" placeholder="원인이나 사람들의 생각 중 더 궁금한 것은 무엇인가요?">${esc(state.question)}</textarea><div class="field-counter" data-counter="question">${state.question.length}/320</div></section><section class="save-panel"><h2>탐구 노트 내려받기</h2><div class="export-row"><button class="primary-button" data-action="export-png">${icon('download')}노트 이미지</button><button class="secondary-button" data-action="print">${icon('print')}인쇄 / PDF</button><button class="secondary-button" data-action="export-txt">글로 내려받기</button><button class="secondary-button" data-action="export-json">기록 파일 저장</button></div><p class="local-note">기록은 이 브라우저에 자동 저장돼요. 다른 기기로 옮길 때에는 ‘기록 파일 저장’ 후 ‘기록 불러오기’를 이용해요.</p><button class="text-button reset-note" data-action="reset">이 기기의 기록 지우기</button></section></div>`;
    main.innerHTML=`<header class="notebook-top"><div><h1>우리의 탐구 바구니</h1><span>주제 ${state.candidates.length}개 · 근거 ${state.facts.length}개</span></div><div class="button-row"><button class="secondary-button" data-action="home">자료 더 찾기</button><button class="text-button" data-action="import">기록 불러오기</button>${step!==4?'<button class="secondary-button" data-action="note-step" data-step="4">저장 / 내려받기</button>':''}</div></header><nav class="note-steps" aria-label="탐구 기록 작성 단계">${steps.map((label,i)=>`<button class="note-step ${step===i+1?'active':''}" data-action="note-step" data-step="${i+1}" ${step===i+1?'aria-current="step"':''}><b>${i+1}</b>${label}</button>`).join('')}</nav><div class="notebook-page" data-note-step="${step}">${content}</div><nav class="notebook-dock" aria-label="기록 단계 앞뒤 이동"><button class="secondary-button" data-action="note-step" data-step="${step-1}" ${step===1?'disabled':''}>${icon('back')}앞 단계</button><span>${step} / 4단계 · 쓴 글은 자동 저장돼요.</span>${step<4?`<button class="primary-button" data-action="note-step" data-step="${step+1}">다음 단계${icon('arrow')}</button>`:'<button class="primary-button" data-action="home">자료 더 찾아보기</button>'}</nav>`;
  }
  function candidateList() {
    showModal('담아 둔 주제 후보',state.candidates.length?`<div class="candidate-list">${state.candidates.map(id=>{const c=findCase(id);return `<div class="candidate"><div><strong>${esc(c.short)}</strong><a href="#case=${id}&tab=evidence">자료 다시 읽기 ↗</a></div><button class="secondary-button" data-action="choose-candidate" data-case="${id}">${state.selected===id?'선택한 주제':'탐구 주제로'}</button><button class="remove-button" data-action="candidate" data-case="${id}" aria-label="${esc(c.short)} 바구니에서 빼기">×</button></div>`;}).join('')}</div>`:'<p>아직 담은 주제가 없어요. 문제 탐색에서 관심 있는 주제를 담아 보세요.</p>');
  }
  function render() {
    const r=route();
    main.classList.remove('home-view');
    document.body.dataset.view=r.view;
    document.body.dataset.tab=r.tab||'';
    document.body.dataset.legacy=r.view==='case'&&r.c.archived?'true':'false';
    document.querySelectorAll('[data-nav]').forEach(b=>{const active=b.dataset.nav===(r.view==='notebook'?'notebook':'explore');b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(r.view==='case')caseView(r.c,r.tab,r.reading,r.page);else if(r.view==='notebook')notebook();else explore();
    document.title=r.view==='case'?`${r.c.short} · 부산 생태탐사대`:r.view==='notebook'?'탐구 바구니 · 부산 생태탐사대':'부산 생태탐사대 · 우리 지역의 문제를 찾아요';
    updateUI();
  }
  function showModal(title,body) {
    lastFocus=document.activeElement;
    document.getElementById('modal-content').innerHTML=`<header class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="창 닫기">×</button></header><div class="modal-body">${body}</div>`;
    if(!modal.open)modal.showModal(); modal.scrollTop=0;
  }
  function closeModal() { modal.close(); if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true}); }
  function sourceCard(id) {
    const s=S[id];
    const topics=D.cases.filter(c=>c.facts.some(f=>f.source===id)||c.extraSource===id);
    return `<article class="source-card"><div>${topics.map(c=>`<span class="source-topic">${esc(c.short)}</span>`).join('')}</div><div class="source-meta">${esc(s.kind)} · ${esc(s.org)} · ${esc(s.date)}</div><h3>${esc(s.title)}</h3><p>${esc(s.note)}</p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">원문에서 확인하기 ↗</a></article>`;
  }
  function sourcesView(ids=Object.keys(D.sources),title='자료 출처와 읽는 방법') {
    showModal(title,`<p>읽기 자료는 아래 원문을 바탕으로 4학년이 읽기 쉽게 다시 구성했어요. 자료의 시기와 범위를 확인하며 읽어 보세요.</p><p class="muted">마지막 원문 확인: ${D.checked} · 원문은 새 창으로 열려요. 외부 사이트가 잠시 열리지 않아도 앱의 읽기 자료는 볼 수 있어요.</p>${ids.map(sourceCard).join('')}<h3>사진과 개념 그림</h3><p class="muted">사진은 각 주제의 ‘사진 크게’에서 제공 기관과 원문을 확인할 수 있어요. 장소·생물 참고 사진이며 사건 현장 사진과 구분해 표시했어요. 관계 그림과 그래프는 원문을 바탕으로 별도 구성했습니다.</p>`);
  }
  function guide() {
    showModal('자료를 읽고 우리 모둠의 문제를 찾아요',`<p>부산의 세 가지 주제를 살펴봐요. 각 주제에는 <strong>지역의 일·생물의 생활·사람들의 노력</strong>을 알아볼 자료가 8개씩 있어요.</p><div class="guide-steps"><div class="guide-step"><span>1</span><div><h3>한 주제의 자료를 골라 읽어요</h3><p>상단 목록에서 읽을 자료를 골라요. 아래 ‘앞 쪽·다음 쪽’으로 넘겨 읽어요. 사진과 숫자 자료도 볼 수 있어요.</p></div></div><div class="guide-step"><span>2</span><div><h3>근거를 담고 설명해요</h3><p>내 생각을 뒷받침하는 자료의 ‘근거 담기’를 눌러요. 자료에서 찾은 사실과 나의 생각을 구분해요.</p></div></div><div class="guide-step"><span>3</span><div><h3>사람과 생물을 함께 생각해요</h3><p>생물에게 생긴 일과 이곳을 이용하는 사람에게 필요한 것을 연결해요. 구청이나 지역 기관이 하는 일도 찾아요.</p></div></div><div class="guide-step"><span>4</span><div><h3>모둠의 문제를 정리해요</h3><p>탐구 바구니의 4단계를 차례로 눌러 정리해요. 쓴 글은 자동 저장돼요. 같은 주제도 서로 다른 제안을 할 수 있어요.</p></div></div></div><p class="muted">출처는 글을 쓴 기관이나 사람, 글이 실린 곳을 뜻해요. 자료가 만들어진 때도 확인해요.</p><div class="button-row" style="margin-top:18px"><button class="primary-button" data-action="close-modal">자료 살펴보기 ${icon('arrow')}</button></div>`);
  }
  function teacher() {
    showModal('선생님을 위한 수업 안내',`<p>사회 ‘지역문제 해결’, 과학 ‘생물과 환경’, 국어 ‘제안하는 글쓰기’를 연결하는 <strong>3개 주제·24개 읽기 자료</strong>입니다. 4학년이 읽을 수 있도록 용어와 문장을 점검했습니다.</p><h3>같은 주제, 서로 다른 제안</h3><p>6모둠이 세 가지 주제 중 자유롭게 고릅니다. 두 모둠 이상이 같은 주제를 골라도, 집중할 문제·제안할 대상·실천 방법이 다를 수 있습니다. 모둠원끼리 자료를 나누어 읽고 찾은 근거를 설명하며 모으는 방식으로도 활용할 수 있습니다.</p><h3>지역문제와 생태계 문제를 함께 보기</h3><ol><li>어떤 생물의 어떤 생활이 어려워졌는가?</li><li>이곳을 이용하거나 관리하는 사람은 누구이며 무엇이 필요한가?</li><li>이미 해 온 일은 무엇이고, 우리가 더 알아볼 것은 무엇인가?</li><li>누구에게 어떤 변화를 제안하며, 그 까닭을 어떤 자료로 설명할 것인가?</li></ol><h3>5차시 연결</h3><p>①자료 조사·문제 발견 → ②해결 방법 비교·선택 → ③개인별 제안하는 글과 고쳐쓰기 → ④모둠별 영상·만화·포스터 제작 → ⑤제안회·질문·수정·전달로 이어 갑니다.</p><h3>읽기 자료의 성격</h3><p>지역 기사, 공공기관의 설명, 생물 자료와 숫자 자료를 짧은 두 문단 글로 재구성했습니다. 각 글에는 사실을 찾는 질문과 사람·생물을 함께 생각하는 질문이 있습니다. 원문의 어려운 제목은 출처 정보로만 보존했습니다. ‘생태계·보전·근거·제안’은 배워야 할 용어로 남겨 쉬운 뜻을 안내합니다.</p><p>숫자가 나타내는 범위와 자료의 날짜를 확인합니다. 과거 조사 결과나 당시 계획을 지금 모두에게 적용되는 상태로 단정하지 않도록 지도해 주세요. 입장 카드는 수업을 위해 구성한 관점이며 실제 인터뷰가 아닙니다.</p><h3>기록과 배포</h3><p>GitHub·Vercel에 배포하는 정적 앱입니다. 로그인·Firebase 설정 없이 각 브라우저에 독립 저장합니다. 같은 주소로 접속해도 모둠 공동편집이나 교사 자동 수합은 이루어지지 않습니다. 대표 기기에 기록하거나 내려받은 노트를 모아 활용할 수 있습니다.</p><p>이전판에 담아 둔 기록은 유지합니다. 홈 화면에는 새 세 주제만 표시하고, 이전 기록에 연결된 자료는 해당 바구니에서 다시 읽거나 내보낼 수 있습니다.</p><h3>자료 관리</h3><p>원문 확인 ${D.checked}. 자료는 자동 갱신되지 않습니다. data.js·SOURCES.md·TEACHER_NOTES.md에서 출처, 용어 점검, 수업 활용 안내를 확인할 수 있습니다.</p>`);
  }
  function toggleCandidate(id,confirmed=false) {
    if(!caseIds.has(id))return;
    const c=findCase(id);
    if(state.candidates.includes(id)){
      const count=state.facts.filter(f=>findFact(f).caseId===id).length;
      if(count&&!confirmed){showModal('이 주제를 바구니에서 뺄까요?',`<p><strong>${esc(c.short)}</strong> 주제와 여기에 담은 근거 ${count}개, 해당 근거에 쓴 메모가 함께 지워져요.</p><p class="muted">‘발견한 문제’와 ‘더 알아보고 싶은 점’에 쓴 글은 남아 있어요.</p><div class="button-row" style="margin-top:20px"><button class="secondary-button" data-action="close-modal">계속 살펴보기</button><button class="primary-button" data-action="confirm-remove" data-case="${id}">주제와 근거 빼기</button></div>`);return;}
      state.candidates=state.candidates.filter(v=>v!==id);state.facts=state.facts.filter(f=>{if(findFact(f).caseId===id){delete state.notes[f];return false;}return true;});if(state.selected===id)state.selected='';toast('바구니에서 주제를 뺐어요.');
    }else{state.candidates.push(id);toast('문제 후보에 담았어요. 탐구 바구니에서 살펴보세요.');}
    save();if(modal.open)closeModal();if(route().view==='notebook')notebook();updateUI();
  }
  function toggleFact(id) {
    const f=findFact(id);if(!f)return;
    if(state.facts.includes(id)){state.facts=state.facts.filter(v=>v!==id);delete state.notes[id];toast('근거를 바구니에서 뺐어요.');}
    else{state.facts.push(id);if(!state.candidates.includes(f.caseId))state.candidates.push(f.caseId);toast('근거와 출처를 바구니에 담았어요.');}
    save();updateUI();
  }
  function compareTable(a,b) {
    const entries=[['장소',a.place,b.place],['자료의 성격',`${a.status} · ${a.dateLabel}`,`${b.status} · ${b.dateLabel}`],['궁금한 점',a.hook,b.hook],['생태계 연결',a.science.question,b.science.question],['살펴볼 입장',a.voices.map(v=>v.who).join(' / '),b.voices.map(v=>v.who).join(' / ')],['더 조사할 것',a.questions[2],b.questions[2]]];
    return `<table class="comparison"><caption class="sr-only">두 탐구 주제 비교</caption><thead><tr><th scope="col">비교</th><th scope="col">${esc(a.short)}</th><th scope="col">${esc(b.short)}</th></tr></thead><tbody>${entries.map(row=>`<tr><th scope="row">${esc(row[0])}</th><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join('')}<tr><th scope="row">원문</th><td>${sourceLink(a.facts[0].source,'대표 자료')}</td><td>${sourceLink(b.facts[0].source,'대표 자료')}</td></tr></tbody></table>`;
  }
  function compare() {
    if(state.candidates.length<2)return;
    compareA=state.candidates[0];compareB=state.candidates[1];
    showModal('우리 모둠은 어떤 문제를 탐구할까요?',`<p class="muted">우리가 관심 있는가, 근거를 더 찾을 수 있는가, 제안할 대상이 떠오르는가를 생각하며 비교하세요.</p><div class="compare-selectors">${['a','b'].map((side,i)=>`<label>비교할 주제 ${i+1}<select class="form-field" id="compare-${side}">${state.candidates.map((id,j)=>`<option value="${id}" ${i===j?'selected':''}>${esc(findCase(id).short)}</option>`).join('')}</select></label>`).join('')}</div><div id="comparison-body">${compareTable(findCase(compareA),findCase(compareB))}</div>`);
  }
  function plainNotes() {
    const c=findCase(state.selected);let lines=['부산 생태탐사대 · 우리의 탐구 노트',`이름/모둠: ${state.name||'(입력하지 않음)'}`,`선택한 주제: ${c?c.short:'(아직 선택하지 않음)'}`,`자료 확인일: ${D.checked}`,'','[우리가 발견한 문제]',state.problem||'(아직 쓰지 않음)','','[생물의 생활에 생기는 일]',state.ecoNote||'(아직 쓰지 않음)','','[이곳의 사람들에게 필요한 것]',state.peopleNote||'(아직 쓰지 않음)','','[제안하고 싶은 대상]',state.target||'(아직 정하지 않음)','','[더 알아보고 싶은 점]',state.question||'(아직 쓰지 않음)','','[문제 후보]',...state.candidates.map((id,i)=>`${i+1}. ${findCase(id).short} / ${findCase(id).place}`),'','[담은 근거와 출처]'];
    state.facts.forEach((id,i)=>{const f=findFact(id),s=S[f.source];lines.push('',`${i+1}. ${f.title}`,f.text,`출처: ${s.org} / ${s.title} / ${s.date}`,s.url);if(state.notes[id])lines.push(`내가 주목한 점: ${state.notes[id]}`);});
    lines.push('','※ 읽기 자료는 원문을 바탕으로 재구성했습니다. 사건·예방 과제, 사실·추정, 통계의 범위를 구분해 해석하세요.');return lines.join('\n');
  }
  function downloadBlob(blob,name) {const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
  function fileStamp(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','');}
  async function exportPNG(){
    try{
      if(document.fonts?.ready)await document.fonts.ready;
      const width=1500,pad=100,contentWidth=1300,measure=document.createElement('canvas').getContext('2d'),ops=[];let y=190;
      function lines(text,size,maxWidth){measure.font=`${size}px "Malgun Gothic","Noto Sans KR",sans-serif`;const out=[];for(const para of String(text).split('\n')){let line='';for(const ch of para){if(measure.measureText(line+ch).width>maxWidth&&line){out.push(line);line=ch;}else line+=ch;}out.push(line);}return out;}
      function add(text,size=28,color='#243e31',gap=16,bold=false){const ls=lines(text,size,contentWidth);ops.push({ls,size,color,bold,y});y+=ls.length*(size*1.65)+gap;}
      function section(title,text){y+=24;add(title,30,'#1e6347',12,true);add(text||'아직 쓰지 않았어요.',27,'#344d3f',10);}
      add(`이름/모둠: ${state.name||'미입력'}     ·     자료 확인 ${D.checked}`,23,'#6c7e71',20);
      section('선택한 탐구 주제',findCase(state.selected)?.short||'아직 선택하지 않았어요.');
      section('우리가 발견한 문제',state.problem);if(state.ecoNote||state.peopleNote||state.target){section('생물의 생활에 생기는 일',state.ecoNote);section('이곳의 사람들에게 필요한 것',state.peopleNote);section('제안하고 싶은 대상',state.target);}section('더 알아보고 싶은 점',state.question);
      if(state.candidates.length)section('함께 살펴본 문제 후보',state.candidates.map(id=>findCase(id).short).join(' · '));
      y+=22;add(`담은 근거 자료 ${state.facts.length}개`,32,'#1e6347',20,true);
      state.facts.forEach((id,i)=>{const f=findFact(id),s=S[f.source];add(`${i+1}. ${f.title}`,29,'#203a30',8,true);add(f.text,26,'#344d3f',9);if(state.notes[id])add(`내가 주목한 점: ${state.notes[id]}`,26,'#4c6548',9);add(`${s.org} · ${s.date}`,21,'#6b7b70',5);add(s.url,18,'#6b7b70',22);});
      if(!state.facts.length)add('아직 담은 근거가 없어요.',26,'#6b7b70',15);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.ceil(y+100);const ctx=canvas.getContext('2d');ctx.fillStyle='#fafbf5';ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle='#1e6347';ctx.fillRect(0,0,width,145);ctx.fillStyle='#fff';ctx.font='bold 48px "Malgun Gothic","Noto Sans KR",sans-serif';ctx.fillText('부산 생태탐사대 · 우리의 탐구 노트',pad,91);ctx.textBaseline='top';
      for(const o of ops){ctx.font=`${o.bold?'bold ':''}${o.size}px "Malgun Gothic","Noto Sans KR",sans-serif`;ctx.fillStyle=o.color;o.ls.forEach((line,i)=>ctx.fillText(line,pad,o.y+i*o.size*1.65));}
      ctx.fillStyle='#81917f';ctx.font='18px "Malgun Gothic","Noto Sans KR",sans-serif';ctx.fillText('원문과 날짜, 통계의 범위를 확인하며 읽어요. · 부산 생태탐사대',pad,canvas.height-52);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('image');downloadBlob(blob,`busan-eco-notes-${fileStamp()}.png`);toast('탐구 노트 이미지를 내려받았어요.');
    }catch{toast('이미지 저장이 어려워요. 글로 내려받기나 인쇄를 이용해 주세요.');}
  }
  function preparePrint(){
    let sheet=document.getElementById('print-sheet');if(!sheet){sheet=document.createElement('article');sheet.id='print-sheet';document.body.append(sheet);}
    sheet.innerHTML=`<h1>부산 생태탐사대 · 우리의 탐구 노트</h1><div class="print-meta">이름/모둠: ${esc(state.name||'미입력')} · 자료 확인 ${D.checked}</div><section><h2>선택한 탐구 주제</h2><p>${esc(findCase(state.selected)?.short||'아직 선택하지 않았어요.')}</p></section><section><h2>우리가 발견한 문제</h2><p class="print-field">${esc(state.problem||'아직 쓰지 않았어요.')}</p></section><section><h2>생물의 생활에 생기는 일</h2><p class="print-field">${esc(state.ecoNote||"아직 쓰지 않았어요.")}</p></section><section><h2>이곳의 사람들에게 필요한 것</h2><p class="print-field">${esc(state.peopleNote||"아직 쓰지 않았어요.")}</p></section><section><h2>제안하고 싶은 대상</h2><p>${esc(state.target||"아직 정하지 않았어요.")}</p></section><section><h2>더 알아보고 싶은 점</h2><p class="print-field">${esc(state.question||'아직 쓰지 않았어요.')}</p></section><section><h2>담은 근거와 출처</h2><ol>${state.facts.map(id=>{const f=findFact(id),s=S[f.source];return `<li><strong>${esc(f.title)}</strong><p>${esc(f.text)}</p>${state.notes[id]?`<p>내가 주목한 점: ${esc(state.notes[id])}</p>`:''}<small>${esc(s.org)} · ${esc(s.title)} · ${esc(s.date)}<br>${esc(s.url)}</small></li>`}).join('')}</ol>${!state.facts.length?'<p>아직 담은 근거가 없어요.</p>':''}</section><p class="print-credit">원문을 바탕으로 재구성한 읽기 자료입니다. 자료의 시기·범위와 사실·추정을 구분해 해석하세요.</p>`;
  }
  function importNotes(){
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);input.addEventListener('cancel',()=>input.remove(),{once:true});
    input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file){input.remove();return;}try{if(file.size>500000)throw new Error();const v=JSON.parse(await file.text());if(v.format!=='busan-eco-notes/v1'||!v.data||typeof v.data!=='object')throw new Error();pendingImport=normalize(v.data);showModal('이 탐구 기록을 불러올까요?',`<p>문제 후보 ${pendingImport.candidates.length}개, 근거 ${pendingImport.facts.length}개가 있는 기록이에요.</p><p>현재 이 기기에 있는 탐구 기록을 불러온 기록으로 바꿉니다. 필요한 기록은 먼저 저장해 주세요.</p><div class="button-row" style="margin-top:20px"><button class="secondary-button" data-action="close-modal">돌아가기</button><button class="primary-button" data-action="confirm-import">기록 불러오기</button></div>`);}catch{toast('이 앱에서 저장한 탐구 기록 JSON 파일을 선택해 주세요.');}finally{input.remove();}});input.click();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;
    const a=b.dataset.action;e.preventDefault();
    if(a==='home'){if(modal.open)closeModal();navigate('#view=explore');}
    else if(a==='notebook'){if(modal.open)closeModal();navigate('#view=notebook');}
    else if(a==='case')navigate(`#case=${b.dataset.case}&tab=evidence`);
    else if(a==='tab')navigate(`#case=${b.dataset.case}&tab=${b.dataset.tab}`);
    else if(a==='reading'){if(modal.open)closeModal();navigate(`#case=${b.dataset.case}&tab=evidence&read=${b.dataset.read}&page=0`);}
    else if(a==='reading-page')moveReading(Number(b.dataset.dir));
    else if(a==='reading-list')readingList(findCase(b.dataset.case));
    else if(a==='home-page'){homePage+=Number(b.dataset.dir);refreshGrid();}
    else if(a==='note-step')navigate(`#view=notebook&step=${Math.max(1,Math.min(4,Number(b.dataset.step)||1))}`);
    else if(a==='saved-fact-page'){const r=route(),index=state.facts.indexOf(state.facts.includes(r.fact)?r.fact:state.facts[0]);const id=state.facts[index+Number(b.dataset.dir)];if(id)navigate(`#view=notebook&step=1&fact=${id}`);}
    else if(a==='candidate-list')candidateList();
    else if(a==='choose-candidate'){if(state.candidates.includes(b.dataset.case)){state.selected=b.dataset.case;save();closeModal();notebook();updateUI();toast('이번에 탐구할 주제로 정했어요.');}}
    else if(a==='science-detail'){const c=findCase(b.dataset.case);showModal(b.dataset.part==='nodes'?'생각한 뒤, 관계 짚어 보기':'배운 과학과 연결하기',b.dataset.part==='nodes'?`<div class="reveal-content">${c.science.nodes.map((n,i)=>`<div class="connection-step"><b>${i+1}</b><div><strong>${esc(n.name)}</strong><p>${esc(n.text)}</p></div></div>`).join('')}</div>`:`<p>${esc(c.science.connection)}</p>`);}
    else if(a==='think-questions'){const c=findCase(b.dataset.case);showModal('우리 모둠이 함께 생각할 질문',`<ol class="question-list">${c.questions.map((q,i)=>`<li><span>${i+1}</span><div>${esc(q)}</div></li>`).join('')}</ol><button class="primary-button" data-action="notebook" style="margin-top:20px">바구니에서 정리하기</button>`);}
    else if(a==='number-table')showModal('부산항에서 주운 양',`<table class="number-table"><caption>부산항의 물에 떠 있는 쓰레기를 주워 모은 기록</caption><thead><tr><th scope="col">연도</th><th scope="col">무게</th></tr></thead><tbody><tr><th scope="row">2023년</th><td>1,556톤</td></tr><tr><th scope="row">2024년</th><td>1,394톤</td></tr><tr><th scope="row">2025년</th><td>850톤</td></tr></tbody></table><p class="figure-scope">부산 바다 전체에서 생기거나 남아 있는 쓰레기의 양은 아니에요.</p>`);
    else if(a==='common-word'){const w=D.glossary[Number(b.dataset.word)];if(w)showModal(w[0],`<p>${esc(w[1])}</p>`);}
    else if(a==='filter'){filter=b.dataset.filter;homePage=0;refreshGrid();}
    else if(a==='clear-search'){filter='전체';search='';homePage=0;document.getElementById('case-search').value='';refreshGrid();}
    else if(a==='candidate')toggleCandidate(b.dataset.case);
    else if(a==='fact')toggleFact(b.dataset.fact);
    else if(a==='remove-fact'){const id=b.dataset.fact;state.facts=state.facts.filter(f=>f!==id);delete state.notes[id];save();notebook();updateUI();toast('근거를 바구니에서 뺐어요.');}
    else if(a==='confirm-remove'){closeModal();toggleCandidate(b.dataset.case,true);}
    else if(a==='font'){state.large=!state.large;save();render();toast(state.large?'글씨를 크게 보여 드려요.':'기본 글씨 크기로 돌아왔어요.');}
    else if(a==='guide')guide();else if(a==='teacher')teacher();else if(a==='sources')sourcesView();else if(a==='source-one')sourcesView([b.dataset.source],'이 자료의 출처');
    else if(a==='case-sources'){const c=findCase(b.dataset.case);sourcesView([...new Set([...c.facts.map(f=>f.source),...(c.extraSource?[c.extraSource]:[])])],`${c.short} · 자료 출처`);}
    else if(a==='close-modal')closeModal();
    else if(a==='photo'){const c=findCase(b.dataset.case);showModal(c.photoLabel,`<figure class="photo-modal"><img src="${c.image}" alt="${esc(c.photoAlt)}"><figcaption>${esc(c.photoLabel)}<br>사진 제공: ${esc(c.photoOrg)} · ${esc(c.photoYear)}<br>${esc(c.photoLicense)} · <a href="${esc(c.photoUrl)}" target="_blank" rel="noopener noreferrer">사진 원문 ↗</a></figcaption></figure>`);}
    else if(a==='word'){const c=findCase(b.dataset.case),w=c.words[Number(b.dataset.word)];if(w)showModal(w[0],`<p>${esc(w[1])}</p><p class="muted" style="margin-top:15px">낱말의 뜻을 알고 자료를 다시 읽어 보세요.</p>`);}
    else if(a==='glass'){const marked=document.getElementById('glass-scene').classList.toggle('marked');b.setAttribute('aria-pressed',String(marked));b.innerHTML=icon(marked?'check':'plus')+(marked?'무늬 숨기기':'유리창에 무늬 보이기');}
    else if(a==='compare')compare();else if(a==='export-png')exportPNG();
    else if(a==='export-txt'){downloadBlob(new Blob(['\ufeff'+plainNotes()],{type:'text/plain;charset=utf-8'}),`busan-eco-notes-${fileStamp()}.txt`);toast('근거와 출처가 포함된 글 파일을 내려받았어요.');}
    else if(a==='export-json'){downloadBlob(new Blob([JSON.stringify({format:'busan-eco-notes/v1',exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'}),`busan-eco-backup-${fileStamp()}.json`);toast('다른 기기에서 불러올 수 있는 기록 파일을 저장했어요.');}
    else if(a==='print'){preparePrint();window.print();}
    else if(a==='import')importNotes();
    else if(a==='confirm-import'&&pendingImport){state=pendingImport;pendingImport=null;save();closeModal();navigate('#view=notebook');render();toast('탐구 기록을 불러왔어요.');}
    else if(a==='reset')showModal('이 기기의 탐구 기록을 지울까요?',`<p>문제 후보, 근거 자료, 입력한 글이 이 브라우저에서 모두 지워져요. 필요한 기록은 먼저 내려받아 주세요.</p><div class="button-row" style="margin-top:20px"><button class="secondary-button" data-action="close-modal">남겨 두기</button><button class="primary-button" data-action="confirm-reset">모든 탐구 기록 지우기</button></div>`);
    else if(a==='confirm-reset'){const large=state.large;state=normalize({large});save();closeModal();render();toast('이 기기의 탐구 기록을 지웠어요.');}
  });
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el.id==='case-search'){search=el.value;homePage=0;refreshGrid();}
    else if(el.dataset.field){const field=el.dataset.field;if(!['name','problem','question','ecoNote','peopleNote','target'].includes(field))return;state[field]=el.value;save();const counter=document.querySelector(`[data-counter="${field}"]`);if(counter)counter.textContent=`${el.value.length}/${el.maxLength}`;}
    else if(el.dataset.note&&factIds.has(el.dataset.note)){state.notes[el.dataset.note]=el.value;save();}
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.name==='chosen-case'&&(el.value===''||caseIds.has(el.value))){state.selected=el.value;save();document.querySelectorAll('.candidate').forEach(c=>c.classList.toggle('selected',!!c.querySelector('input:checked')));toast(el.value?'이번에 탐구할 주제로 정했어요.':'탐구할 주제를 아직 고르지 않았어요.');}
    if(el.id==='reading-select')navigate(`#case=${el.dataset.case}&tab=evidence&read=${el.value}&page=0`);
    if(el.id==='saved-fact-select'&&state.facts.includes(el.value))navigate(`#view=notebook&step=1&fact=${el.value}`);
    if(el.id==='compare-a'||el.id==='compare-b'){
      const side=el.id.endsWith('a')?'a':'b';if(side==='a')compareA=el.value;else compareB=el.value;
      if(compareA===compareB){const other=state.candidates.find(id=>id!==el.value);if(side==='a'){compareB=other;document.getElementById('compare-b').value=other;}else{compareA=other;document.getElementById('compare-a').value=other;}}
      document.getElementById('comparison-body').innerHTML=compareTable(findCase(compareA),findCase(compareB));
    }
  });
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  modal.addEventListener('cancel',()=>{if(lastFocus?.isConnected)setTimeout(()=>lastFocus.focus({preventScroll:true}),0);});
  window.addEventListener('hashchange',()=>{if(modal.open)modal.close();render();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});});
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const r=route();if(r.view==='explore')refreshGrid();else if(r.view==='case'&&r.tab==='evidence')render();},120);});
  document.addEventListener('keydown',e=>{if(modal.open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(route().view==='case'&&route().tab==='evidence'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveReading(e.key==='ArrowRight'?1:-1);}});
  window.addEventListener('beforeprint',preparePrint);
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus({preventScroll:true});main.scrollIntoView({block:'start'});});
  render();
})();
