// ===== Cấu hình (chỉnh tại đây) =====
const EXAM_SIZE = 40;      // số câu mỗi đề thi thử
const EXAM_MINUTES = 40;   // thời gian làm bài (phút)
// ----- Cấu hình AI (mặc định Groq; muốn dùng OpenAI thì đổi 2 dòng dưới) -----
const AI_URL = 'https://api.groq.com/openai/v1/chat/completions';   // OpenAI: https://api.openai.com/v1/chat/completions
const AI_MODEL = 'openai/gpt-oss-120b';   // model dự phòng; web sẽ tự hỏi API và chọn model dùng được (OpenAI: gpt-4o-mini)
const CH = ["Chương 1: Khái niệm & đặc trưng cơ bản","Chương 2: Cảm biến vị trí & dịch chuyển","Chương 3: Cảm biến quang","Chương 4: Cảm biến lực"];

const $ = s => document.querySelector(s), app = $('#app');
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const BANK = QUESTIONS.map((q, i) => ({ id: i, ch: q[0], q: q[1], o: q[2], a: q[3], e: q[4] }));
let S, T;

// Đảo thứ tự đáp án, cập nhật lại vị trí đáp án đúng
const prep = list => list.map(q => { const ord = shuffle(q.o.map((_, i) => i)); return { ...q, o: ord.map(i => q.o[i]), a: ord.indexOf(q.a) }; });

// Dark/light
document.documentElement.dataset.theme = load('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; save('theme', t); };

// ===== Màn hình chính =====
function home() {
  clearInterval(T);
  const hist = load('hist', []), nw = Object.keys(load('wrong', {})).length;
  app.innerHTML = `<h2>Chọn phạm vi</h2>
  ${CH.map((c, i) => `<label class="chk"><input type="checkbox" class="ch" value="${i + 1}" checked> ${c}</label>`).join('')}
  <div class="row">
    <button onclick="start('practice')">Luyện tập</button>
    <button onclick="start('exam')">Thi thử (${EXAM_SIZE} câu / ${EXAM_MINUTES} phút)</button>
    <button class="alt" onclick="aiExam()">🤖 Thi thử AI (đề mới mỗi lần)</button>
    <button class="alt" ${nw ? '' : 'disabled'} onclick="start('wrong')">Ôn câu hay sai (${nw})</button>
  </div>
  <h3>Lịch sử gần đây</h3>
  ${hist.slice(-5).reverse().map(h => `<p>${h.d} · ${h.mode} · <b>${h.score}/10</b> (${h.right}/${h.n})</p>`).join('') || '<p>Chưa có lần làm nào.</p>'}`;
}

// ===== Bắt đầu làm bài =====
function start(mode) {
  const chs = [...document.querySelectorAll('.ch:checked')].map(c => +c.value);
  let pool;
  if (mode === 'wrong') { const w = load('wrong', {}); pool = BANK.filter(q => w[q.id]); }
  else if (mode === 'exam') {
    const per = Math.ceil(EXAM_SIZE / (chs.length || 1));   // chia đều số câu mỗi chương
    pool = shuffle(chs.flatMap(c => shuffle(BANK.filter(q => q.ch === c)).slice(0, per))).slice(0, EXAM_SIZE);
  } else pool = BANK.filter(q => chs.includes(q.ch));
  if (!pool.length) return alert('Hãy chọn ít nhất 1 chương.');
  begin(mode, pool);
}
function begin(mode, pool) {
  S = { mode, list: prep(shuffle(pool)), i: 0, ans: [], flag: new Set(), t: EXAM_MINUTES * 60 };
  clearInterval(T);
  if (mode === 'exam') T = setInterval(() => { if (--S.t <= 0) finish(); else tick(); }, 1000);
  quiz();
}
function tick() { const e = $('#tm'); if (e && S.mode === 'exam') e.textContent = `⏱ ${Math.floor(S.t / 60)}:${String(S.t % 60).padStart(2, '0')}`; }

// ===== Hiển thị câu hỏi =====
function quiz() {
  const q = S.list[S.i], a = S.ans[S.i], exam = S.mode === 'exam', show = !exam && a != null, last = S.i === S.list.length - 1;
  app.innerHTML = `<div class="top"><span>Câu ${S.i + 1}/${S.list.length} · ${CH[q.ch - 1].split(':')[0]}</span><span id="tm"></span></div>
  <h3>${q.q}</h3>
  ${q.o.map((o, i) => `<button class="opt ${a === i ? 'sel' : ''} ${show ? (i === q.a ? 'ok' : a === i ? 'bad' : '') : ''}" ${show ? 'disabled' : ''} onclick="pick(${i})">${'ABCD'[i]}. ${o}</button>`).join('')}
  ${show ? `<p class="exp">${a === q.a ? '✅ Đúng. ' : '❌ Sai. '}${q.e}</p>` : ''}
  <div class="row">
    <button class="alt" onclick="go(-1)">‹ Trước</button>
    <button onclick="go(1)">${last ? (exam ? 'Câu đầu' : 'Kết thúc') : 'Tiếp ›'}</button>
    ${exam ? `<button class="alt" onclick="toggleFlag()">${S.flag.has(S.i) ? 'Bỏ đánh dấu' : '🚩 Đánh dấu'}</button>` : ''}
    <button class="danger" onclick="finish()">${exam ? 'Nộp bài' : 'Dừng & chấm'}</button>
  </div>
  ${exam ? `<div class="nav">${S.list.map((_, i) => `<button class="n ${S.ans[i] != null ? 'done' : ''} ${S.flag.has(i) ? 'fl' : ''} ${i === S.i ? 'cur' : ''}" onclick="S.i=${i};quiz()">${i + 1}</button>`).join('')}</div>` : ''}`;
  tick();
}
function pick(i) { if (S.mode !== 'exam' && S.ans[S.i] != null) return; S.ans[S.i] = i; quiz(); }
function go(d) {
  const n = S.i + d;
  if (n >= S.list.length) return S.mode === 'exam' ? (S.i = 0, quiz()) : finish();
  S.i = Math.max(0, n); quiz();
}
function toggleFlag() { S.flag.has(S.i) ? S.flag.delete(S.i) : S.flag.add(S.i); quiz(); }

// ===== Chấm điểm =====
function finish() {
  clearInterval(T);
  const n = S.list.length, wrong = load('wrong', {}), per = [0, 1, 2, 3, 4].map(() => [0, 0]);
  let right = 0;
  S.list.forEach((q, i) => {
    per[q.ch][1]++;
    if (S.ans[i] === q.a) { right++; per[q.ch][0]++; if (q.id >= 0) delete wrong[q.id]; }
    else if (S.ans[i] != null || S.mode === 'exam') if (q.id >= 0) wrong[q.id] = 1;   // câu chưa làm ở chế độ luyện tập thì không tính là "hay sai"
  });
  const score = (right / n * 10).toFixed(2);
  const hist = load('hist', []); hist.push({ d: new Date().toLocaleString('vi-VN'), mode: { exam: 'Thi thử', practice: 'Luyện tập', wrong: 'Ôn câu sai' }[S.mode], score, right, n });
  save('hist', hist.slice(-30)); save('wrong', wrong);
  const bad = S.list.filter((q, i) => S.ans[i] !== q.a);
  app.innerHTML = `<h2>Kết quả</h2>
  <div class="score">${score}/10</div><p>Đúng ${right}/${n} · Sai/bỏ trống ${n - right}</p>
  ${[1, 2, 3, 4].filter(c => per[c][1]).map(c => `<p>${CH[c - 1]}: ${per[c][0]}/${per[c][1]} (${Math.round(per[c][0] / per[c][1] * 100)}%)<div class="bar"><i style="width:${per[c][0] / per[c][1] * 100}%"></i></div></p>`).join('')}
  <div class="row"><button onclick="home()">Về trang chủ</button>${bad.length ? `<button class="alt" onclick="retry()">Làm lại ${bad.length} câu sai</button>` : ''}</div>
  <h3>Các câu sai</h3>
  ${bad.map(q => `<div class="wr"><b>${q.q}</b><br>✔ ${q.o[q.a]}<br><small>${q.e}</small></div>`).join('') || '<p>Không có câu nào sai 🎉</p>'}`;
  S.bad = bad;
}
function retry() { begin('wrong', S.bad); }

// ===== Thi thử AI: mỗi lần AI sinh một đề mới từ nội dung slide =====
const ANGLES = ['định nghĩa và khái niệm', 'so sánh/phân biệt', 'câu "phát biểu nào sau đây SAI"', 'tình huống ứng dụng', 'ưu điểm - nhược điểm', 'nguyên lý hoạt động và cấu tạo', 'công thức và đại lượng'];
let MODEL = null;
// Hỏi API danh sách model đang có, chọn model ưu tiên đầu tiên có mặt
async function getModel() {
  if (MODEL) return MODEL;
  try {
    const r = await fetch(AI_URL.replace('/chat/completions', '/models'), { headers: { Authorization: 'Bearer ' + load('key', '') } });
    const ids = (await r.json()).data.map(m => m.id);
    const pref = [AI_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gpt-4o-mini'];
    MODEL = pref.find(m => ids.includes(m)) || ids.find(i => !/whisper|tts|guard|orpheus|compound|embed|safeguard/i.test(i)) || AI_MODEL;
  } catch { MODEL = AI_MODEL; }
  return MODEL;
}
async function aiChapter(c, n) {
  const model = await getModel();
  const angle = shuffle(ANGLES).slice(0, 3).join('; ');
  const r = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + load('key', '') },
    body: JSON.stringify({
      model, temperature: 1, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Bạn là giảng viên ra đề trắc nghiệm bằng tiếng Việt. CHỈ dựa vào nội dung slide được cung cấp, không thêm kiến thức ngoài. Chỉ có đúng 1 đáp án đúng, các đáp án nhiễu hợp lý.' },
        { role: 'user', content: `Nội dung slide (${CH[c - 1]}):\n${SLIDES[c]}\n\nHãy ra ${n} câu trắc nghiệm 4 đáp án, ưu tiên các dạng: ${angle}. Mã ngẫu nhiên để đề khác nhau: ${Math.random().toString(36).slice(2)}.\nTrả về JSON: {"questions":[{"q":"...","o":["A","B","C","D"],"a":0,"e":"giải thích ngắn"}]} (a là chỉ số 0-3 của đáp án đúng).` }
      ]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.status);
  return JSON.parse(j.choices[0].message.content).questions
    .filter(x => x.q && Array.isArray(x.o) && x.o.length === 4 && x.a >= 0 && x.a < 4)
    .map(x => ({ id: -1, ch: c, q: x.q, o: x.o, a: x.a, e: x.e || '' }));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => { app.innerHTML = `<h2>🤖 AI đang ra đề...</h2><p>${t}</p>`; };
// Gọi 1 chương; nếu bị giới hạn tốc độ (rate limit) thì đợi rồi thử lại
async function aiRetry(c, per, tries = 8) {
  for (let k = 0; ; k++) {
    try { return await aiChapter(c, per); }
    catch (e) {
      if (!/rate limit/i.test(e.message) || k >= tries - 1) throw e;
      const m = /try again in ([\d.]+)\s*(m|s)/i.exec(e.message);
      const w = Math.ceil(m ? (+m[1]) * (m[2] === 'm' ? 60 : 1) : 15) + 3;
      for (let t = w; t > 0; t--) { say(`Đã chạm giới hạn của gói miễn phí, tự đợi ${t}s rồi thử lại (${CH[c - 1].split(':')[0]})...`); await sleep(1000); }
    }
  }
}
async function aiExam() {
  if (!load('key', '')) {
    const k = prompt('Dán API key (Groq/OpenAI) (chỉ lưu trong trình duyệt của bạn, dùng cá nhân thôi, đừng đưa web này lên mạng công khai):');
    if (!k) return; save('key', k.trim());
  }
  const chs = [...document.querySelectorAll('.ch:checked')].map(c => +c.value);
  if (!chs.length) return alert('Hãy chọn ít nhất 1 chương.');
  app.innerHTML = '<h2>🤖 AI đang ra đề...</h2><p>Khoảng 10-30 giây, vui lòng chờ.</p>';
  try {
    const per = Math.ceil(EXAM_SIZE / chs.length);
    const pool = [];
    for (const [i, c] of chs.entries()) { say(`Đang ra câu hỏi ${CH[c - 1].split(':')[0]} (${i + 1}/${chs.length})...`); pool.push(...await aiRetry(c, per)); }
    if (pool.length < 5) throw new Error('AI trả về quá ít câu hợp lệ');
    begin('exam', shuffle(pool).slice(0, EXAM_SIZE));
  } catch (e) {
    app.innerHTML = `<h2>Lỗi</h2><p>${e.message}</p><p>Nếu lỗi liên quan key, hãy nhập lại key.</p><div class="row"><button onclick="home()">Về trang chủ</button><button class="alt" onclick="localStorage.removeItem('key');home()">Xóa key đã lưu</button></div>`;
  }
}

home();