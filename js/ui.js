/* Thành phần dùng chung: thông báo, hộp thoại, phân trang và biểu đồ SVG. */
(function () {
  const $ = SG.$;
  SG.badge = result => { const meta=SG.RES[result] || SG.RES.pending; return `<span class="badge ${SG.esc(result)}">${SG.ic(meta.i)}${meta.t}</span>`; };
  SG.empty = (title='Không tìm thấy kết quả', hint='Thử đổi từ khóa hoặc xóa bộ lọc.') => `<div class="empty-state">${SG.ic('ph-magnifying-glass')}<b>${SG.esc(title)}</b><p>${SG.esc(hint)}</p></div>`;
  let toastTimer;
  SG.toast = (message,kind='success') => {
    clearTimeout(toastTimer); const el=$('#toast');
    el.innerHTML=SG.ic(kind==='error'?'ph-warning-circle':'ph-check-circle')+SG.esc(message); el.dataset.kind=kind; el.hidden=false;
    toastTimer=setTimeout(()=>el.hidden=true,4200);
  };
  SG.dialog = (title,body) => {
    const dialog=$('#dlg');
    dialog.innerHTML=`<div class="section-head"><h2 id="dialog-title">${SG.esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Đóng hộp thoại">${SG.ic('ph-x')}</button></div>${body}`;
    dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
    if (!dialog.open) dialog.showModal();
    return dialog;
  };
  SG.pager = (selector, state, total, redraw) => {
    const element=$(selector), pages=Math.max(1,Math.ceil(total/state.size));
    state.page=Math.min(Math.max(1,state.page),pages);
    // Giữ các nút và select để cập nhật nền không làm mất focus bàn phím.
    if (!element.children.length) {
      element.innerHTML=`<span class="pager-count"></span><div class="pager-controls"><label class="per-page">Mỗi trang <select aria-label="Số bản ghi mỗi trang">${[10,20,50].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><div class="page-buttons"><button class="icon-btn" data-n="-1" aria-label="Trang trước">${SG.ic('ph-caret-left')}</button><span class="pager-range" aria-live="polite"></span><button class="icon-btn" data-n="1" aria-label="Trang sau">${SG.ic('ph-caret-right')}</button></div></div>`;
      element.querySelector('select').onchange=e=>{state.size=+e.target.value;state.page=1;redraw();};
      element.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{state.page+=+b.dataset.n;redraw();});
    }
    const start=total?(state.page-1)*state.size+1:0,end=Math.min(total,state.page*state.size);
    element.querySelector('.pager-count').textContent=`${start}–${end} trong ${total} bản ghi`;
    element.querySelector('select').value=String(state.size);
    element.querySelector('.pager-range').textContent=`Trang ${state.page} / ${pages}`;
    element.querySelector('[data-n="-1"]').disabled=state.page<=1;
    element.querySelector('[data-n="1"]').disabled=state.page>=pages;
  };
  function scale(values,type) {
    const min=Math.min(...values),max=Math.max(...values),range=Math.max(max-min,type==='temperature'?1:10),raw=range/3;
    const power=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].find(k=>k*power>=raw)*power;
    const low=Math.floor((min-range*.16)/step)*step,high=Math.ceil((max+range*.16)/step)*step;
    return {lo:type==='temperature'?low:Math.max(0,low),hi:high,step};
  }
  function chartSVG(type,points,width,height,compact=false) {
    const meta=SG.META[type],values=points.map(p=>p.value),domain=scale(values,type),L=39,R=12,T=13,B=compact?19:27;
    const x=i=>L+i*(width-L-R)/Math.max(1,points.length-1),y=v=>T+(1-(v-domain.lo)/(domain.hi-domain.lo))*(height-T-B);
    let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${meta.l}: ${points.length} lần đo gần nhất, từ ${SG.val(points[0])} đến ${SG.val(points.at(-1))}">`;
    const ticks=compact?2:4;
    for(let i=0;i<=ticks;i++) {
      const value=domain.lo+(domain.hi-domain.lo)*i/ticks,yy=y(value);
      svg+=`<line x1="${L}" x2="${width-R}" y1="${yy}" y2="${yy}" stroke="#e9eee8" stroke-dasharray="3 4"/><text x="${L-9}" y="${yy+3}" text-anchor="end" font-size="9" fill="#6b7f71">${value.toFixed(meta.d)}</text>`;
    }
    const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    svg+=`<path d="${path} L${x(points.length-1)},${height-B} L${x(0)},${height-B} Z" fill="${meta.c}" opacity=".07"/><path d="${path}" fill="none" stroke="${meta.c}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(points.length-1)}" cy="${y(points.at(-1).value)}" r="4" fill="${meta.c}" stroke="#fff" stroke-width="2"/><line class="cursor-line" y1="${T}" y2="${height-B}" stroke="${meta.c}" stroke-dasharray="3 3" visibility="hidden"/>`;
    const labels=compact?[0,points.length-1]:[0,Math.floor((points.length-1)/3),Math.floor((points.length-1)*2/3),points.length-1];
    [...new Set(labels)].forEach(i=>{svg+=`<text x="${x(i)}" y="${height-5}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}" font-size="8" fill="#6b7f71">${SG.fmtT(points[i].ts)}</text>`;});
    return {svg:svg+'</svg>',x,width};
  }
  SG.chart = (element,mode) => {
    if (!element || !element.closest('#p-home') || element.closest('#p-home').classList.contains('hide')) return;
    const S=SG.state,types=[SG.TYPES.includes(mode)?mode:'temperature'],width=Math.max(270,element.clientWidth||500);
    const activeType=document.activeElement?.dataset.chartType;
    if (!S.ready || !S.readings.length) { element.innerHTML=`<div class="chart-empty">${SG.empty(S.ready?'Chưa có dữ liệu':'Đang tải dữ liệu…',S.ready?'Dữ liệu mới sẽ xuất hiện tại đây.':'Chờ một chút để chuẩn bị khu vườn.')}</div>`;return; }
    const compact=false;
    element.classList.toggle('chart-multiple',compact);
    const series=types.map(type=>({type,points:S.readings.filter(r=>r.type===type).slice(0,12).reverse()})).filter(s=>s.points.length);
    element.innerHTML=series.map(({type,points})=>{
      const meta=SG.META[type],n=points.length,values=points.map(p=>p.value),summary=compact?SG.val(points.at(-1)):(S.online?'Mỗi 5 giây':'Đã dừng cập nhật');
      const built=chartSVG(type,points,width,compact?88:205,compact);
      return `<div class="${compact?'mini-chart':'single-chart'}" style="--chart-color:${meta.c}"><div class="chart-summary"><span><i class="color-dot"></i>${meta.l} (${meta.u})</span><b>${summary}</b></div><div class="chart-box" tabindex="0" role="group" data-chart-type="${type}" aria-label="Biểu đồ ${meta.l}. Dùng phím mũi tên trái hoặc phải để đọc từng điểm.">${built.svg}<div class="tip" hidden></div></div>${!compact?`<div class="chart-stats"><div><span>Thấp nhất</span><b>${Math.min(...values).toFixed(meta.d)} ${meta.u}</b></div><div><span>Trung bình</span><b>${(values.reduce((a,b)=>a+b,0)/n).toFixed(meta.d)} ${meta.u}</b></div><div><span>Cao nhất</span><b>${Math.max(...values).toFixed(meta.d)} ${meta.u}</b></div></div>`:''}</div>`;
    }).join('')+`<p class="chart-keyboard" ${compact?'':'aria-live="polite"'}>${compact?'Mỗi cảm biến có thang đo riêng. Cùng 12 thời điểm gần nhất.':'Di chuột hoặc dùng phím ← → trên biểu đồ để xem từng lần đo.'}</p>`;
    series.forEach(({type,points})=>{
      const box=element.querySelector(`[data-chart-type="${type}"]`),tip=box.querySelector('.tip'),line=box.querySelector('.cursor-line'),built=chartSVG(type,points,width,205,compact);
      let index=points.length-1;
      function show(i,keyboard=false) {
        index=Math.max(0,Math.min(points.length-1,i));
        const p=points[index];tip.hidden=false;tip.innerHTML=`${SG.fmtT(p.ts)}<br><b>${SG.val(p)}</b>`;
        tip.style.left=Math.min(85,Math.max(15,built.x(index)/width*100))+'%';
        line.setAttribute('x1',built.x(index));line.setAttribute('x2',built.x(index));line.setAttribute('visibility','visible');
        if(keyboard){const output=element.querySelector('.chart-keyboard');output.setAttribute('aria-live','polite');output.textContent=`${SG.META[type].l} · ${SG.fmt(p.ts)} · ${SG.val(p)}`;}
      }
      box.onpointermove=e=>{const r=box.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*width;show(points.reduce((best,_,i)=>Math.abs(built.x(i)-px)<Math.abs(built.x(best)-px)?i:best,0));};
      box.onpointerleave=()=>{tip.hidden=true;line.setAttribute('visibility','hidden');};
      box.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?points.length-1:index+(e.key==='ArrowRight'?1:-1),true);}};
      if(activeType===type)box.focus({preventScroll:true});
    });
  };
})();
