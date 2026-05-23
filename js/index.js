import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_PATH = path.join(__dirname, '..');
const TXT_PATH = path.join(ROOT_PATH, 'todo.txt');

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
}

function generateCardsHTML() {
    const todayStr = formatDate(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    if (!fs.existsSync(TXT_PATH)) {
        fs.writeFileSync(TXT_PATH, `${todayStr}\n[ ] Задача 1\n\n${tomorrowStr}\n[ ] Задача 2`, 'utf-8');
    }

    const content = fs.readFileSync(TXT_PATH, 'utf-8');
    const lines = content.split('\n').map(line => line.trim());
    const todoData = {};
    let currentSection = null;

    for (let line of lines) {
        if (!line) continue;
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(line)) {
            currentSection = line;
            todoData[currentSection] = [];
        } else if (currentSection) {
            const isDone = line.startsWith('[x]') || line.startsWith('[X]');
            const cleanText = line.replace(/^\[[xX ]\]\s*/, '');
            todoData[currentSection].push({ text: cleanText, isDone });
        }
    }

    const parseTasks = (tasks) => {
        if (!tasks || tasks.length === 0) return '<li>☐ Задач нет</li>';
        return tasks.map(t => `
            <li class="${t.isDone ? 'done' : ''}">
                ${t.isDone ? '✓' : '☐'} ${t.text}
            </li>
        `).join('');
    };

    return `
        <div class="card today">
            <h2>СЕГОДНЯ • ${todayStr}</h2>
            <ul>${parseTasks(todoData[todayStr])}</ul>
        </div>
        <div class="card tomorrow">
            <h2>ЗАВТРА • ${tomorrowStr}</h2>
            <ul>${parseTasks(todoData[tomorrowStr])}</ul>
        </div>
    `;
}

const server = http.createServer((req, res) => {

    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(path.join(ROOT_PATH, 'index.html')));
    } 

    else if (req.url === '/css/style.css') {
        const cssPath = path.join(ROOT_PATH, 'css', 'style.css');
        if (fs.existsSync(cssPath)) {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            res.end(fs.readFileSync(cssPath));
        } else {
            res.writeHead(404); res.end();
        }
    }

    else if (req.url === '/video/video.mp4') {
        const videoPath = path.join(ROOT_PATH, 'video', 'video.mp4');
        if (!fs.existsSync(videoPath)) {
            res.writeHead(404);
            return res.end();
        }
        const stat = fs.statSync(videoPath);
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4'
            });
            file.pipe(res);
        } else {
            res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
            fs.createReadStream(videoPath).pipe(res);
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3000, () => {
    console.log('HTTP Сервер успешно перезапущен с учетом новой структуры на http://localhost:3000');
});

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
    ws.send(generateCardsHTML());
});

let timeoutId;
fs.watch(TXT_PATH, (eventType) => {
    if (eventType === 'change') {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const html = generateCardsHTML();
            wss.clients.forEach(client => {
                if (client.readyState === 1) client.send(html);
            });
            console.log('Задачи обновлены!');
        }, 100);
    }
});