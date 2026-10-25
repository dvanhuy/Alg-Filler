
const $ = id => document.getElementById(id);

let kept = [];
let hasFiltered = false;


function togglePanel(contentId, button) {
    const panel = button.closest('.panel');
    const dock = document.getElementById('showDock');
    const main = document.querySelector('main');

    if (!panel || !dock || !main) return;

    // Nếu khung đang hiện thì ẩn nó
    if (panel.style.display !== 'none') {
        panel.style.display = 'none';

        const showButton = document.createElement('button');
        showButton.type = 'button';
        showButton.dataset.panel = contentId;
        showButton.textContent =
            contentId === 'inputContent'
                ? 'Hiện Input'
                : contentId === 'filterContent'
                    ? 'Hiện Filler'
                    : 'Hiện khung';

        showButton.addEventListener('click', () => {
            panel.style.display = '';
            showButton.remove();
            updatePanelLayout();
        });

        dock.appendChild(showButton);
    } else {
        panel.style.display = '';
    }

    updatePanelLayout();
}

function updatePanelLayout() {
    const main = document.querySelector('main');
    const leftSection = main.querySelector(':scope > section:first-child');
    const panels = [...leftSection.querySelectorAll(':scope > .panel')];
    const visiblePanels = panels.filter(
        panel => panel.style.display !== 'none'
    );

    // Ẩn luôn cột trái khi cả hai khung đã ẩn
    leftSection.style.display = visiblePanels.length ? '' : 'none';

    // Nếu còn khung bên trái, giữ bố cục hai cột
    main.classList.toggle('center-layout', visiblePanels.length === 0);
}


// Tách các nước đi Rubik: R, R', R2, r, M2, x, y'...
function getTokens(line) {
    return line.match(/[A-Za-z]+(?:2|')?/g) || [];
}

// Đọc các ký hiệu cần loại bỏ
function getBanned() {
    let items = $('exclude').value
        .split(/[,\s]+/)
        .filter(Boolean);

    if ($('variants').checked) {
        const expanded = [];

        for (const item of items) {
            const base = item.replace(/(?:2|')+$/g, '');
            expanded.push(item, base, base + "'", base + '2');
        }

        items = expanded;
    }

    if ($('wide').checked) {
        items.push('r', 'l', 'u', 'd', 'f', 'b');
    }

    if ($('ignoreCase').checked) {
        items = items.map(item => item.toLowerCase());
    }

    return new Set(items);
}

// Hiển thị danh sách ở bên phải
function renderFormulas(lines) {
    $('results').replaceChildren();

    if (lines.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Không có công thức để hiển thị.';
        $('results').appendChild(empty);
    }

    lines.forEach((line, index) => {
        const row = document.createElement('div');
        row.className = 'formula';

        const number = document.createElement('span');
        number.className = 'number';
        number.textContent = (index + 1) + '.';

        const alg = document.createElement('span');
        alg.className = 'alg';
        alg.textContent = line;

        const copy = document.createElement('button');
        copy.className = 'copy-one';
        copy.textContent = 'Copy';
        copy.addEventListener('click', () => copyText(line));

        row.append(number, alg, copy);
        $('results').appendChild(row);
    });

    $('resultText').value = lines.join('\n');
    $('resultText').style.display = lines.length ? 'block' : 'none';
}

// Hiển thị nguyên danh sách, chưa lọc
function showAllFormulas() {
    const lines = $('source').value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    kept = lines;
    hasFiltered = false;

    $('total').textContent = lines.length;
    $('removed').textContent = 0;
    $('remaining').textContent = lines.length;

    $('summary').textContent =
        `Đã nhập ${lines.length} công thức. Chưa áp dụng bộ lọc.`;

    $('message').textContent = '';

    renderFormulas(lines);
}

// Lọc khi bấm nút Lọc
function filterFormulas() {
    const lines = $('source').value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const banned = getBanned();
    const ignoreCase = $('ignoreCase').checked;
    const allowXYZFirst = $('allowXYZFirst').checked;

    const rejected = [];
    kept = [];

    for (const line of lines) {
        const tokens = getTokens(line);
        const weightedLength = formulaWeight(line);

if (
    weightedLength < Number($('minLength').value) ||
    weightedLength > Number($('maxLength').value)
) {
    rejected.push(line);
    continue;
}

        const shouldRemove = tokens.some((token, index) => {
            // Cho phép x, y, z ở đầu công thức
            if (allowXYZFirst && index === 0) {
                const move = token.toLowerCase();

                if (/^[xyz](?:2|')?$/.test(move)) {
                    return false;
                }
            }

            const key = ignoreCase ? token.toLowerCase() : token;
            return banned.has(key);
        });

        if (shouldRemove) {
            rejected.push(line);
        } else {
            kept.push(line);
        }
    }

    hasFiltered = true;

    $('total').textContent = lines.length;
    $('removed').textContent = rejected.length;
    $('remaining').textContent = kept.length;

    $('summary').textContent =
        `Đã lọc ${lines.length} công thức. ` +
        `Đã loại ${rejected.length}, hiện còn ${kept.length}.`;

    $('message').textContent =
        `Hoàn tất: giữ lại ${kept.length}/${lines.length} công thức.`;

    renderFormulas(kept);

    // Lưu kết quả lọc để có thể khôi phục sau F5
    localStorage.setItem('pll_kept', JSON.stringify(kept));
    localStorage.setItem('pll_hasFiltered', 'true');
    updateLengthRange();
}

// Sao chép văn bản
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        $('message').textContent = 'Đã sao chép!';
    } catch {
        $('resultText').style.display = 'block';
        $('resultText').value = text;
        $('resultText').focus();
        $('resultText').select();
        $('message').textContent = 'Nhấn Ctrl+C để sao chép.';
    }
}

// Lưu các tùy chọn bộ lọc
function saveSettings() {
    localStorage.setItem('pll_exclude', $('exclude').value);
    localStorage.setItem('pll_allowXYZFirst', $('allowXYZFirst').checked);
    localStorage.setItem('pll_ignoreCase', $('ignoreCase').checked);
    localStorage.setItem('pll_wide', $('wide').checked);
    localStorage.setItem('pll_variants', $('variants').checked);
}

// Nút Lọc
$('filterBtn').addEventListener('click', filterFormulas);

// Nút Sao chép tất cả công thức đang hiển thị
$('copyAll').addEventListener('click', () => {
    if (kept.length === 0) {
        $('message').textContent = 'Không có công thức để sao chép.';
        return;
    }

    copyText(kept.join('\n'));
});

// Ẩn/hiện khu vực kết quả
$('toggleBtn').addEventListener('click', () => {
    const hidden = $('resultArea').classList.toggle('hidden');
    $('toggleBtn').textContent = hidden ? 'Hiện kết quả' : 'Ẩn kết quả';
});

// // Xóa danh sách công thức
// $('clearBtn').addEventListener('click', () => {
//     $('source').value = '';
//     localStorage.setItem('pll_source', '');
//     localStorage.removeItem('pll_kept');
//     localStorage.removeItem('pll_hasFiltered');

//     kept = [];
//     hasFiltered = false;

//     showAllFormulas();
// });

// Đặt lại bộ lọc, không tự lọc
$('resetBtn').addEventListener('click', () => {
    $('exclude').value = 'x y z M E S';
    $('allowXYZFirst').checked = false;
    $('ignoreCase').checked = false;
    $('wide').checked = false;
    $('variants').checked = false;

    saveSettings();
    showAllFormulas();
});

// Tự lưu nội dung khi nhập hoặc paste.
// Chỉ hiển thị toàn bộ, không tự chạy lọc.
$('source').addEventListener('input', () => {
    localStorage.setItem('pll_source', $('source').value);
    localStorage.removeItem('pll_kept');
    localStorage.removeItem('pll_hasFiltered');

    updateLengthRange(); // Cập nhật Min-Max theo công thức mới
    showAllFormulas();
});

// Lưu tùy chọn ngay khi thay đổi
$('exclude').addEventListener('input', () => {
    saveSettings();
    updateLengthRange(true);
});

['allowXYZFirst', 'ignoreCase', 'wide', 'variants']
    .forEach(id => {
        $(id).addEventListener('change', () => {
            saveSettings();
            updateLengthRange(true);
        });
    });

// Ctrl + Enter để lọc nhanh
$('source').addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        filterFormulas();
    }
});

// Khôi phục nội dung sau khi tải lại trang
$('source').value = localStorage.getItem('pll_source') || '';

$('exclude').value =
    localStorage.getItem('pll_exclude') ?? 'x y z M E S';

$('allowXYZFirst').checked =
    localStorage.getItem('pll_allowXYZFirst') === 'true';

$('ignoreCase').checked =
    localStorage.getItem('pll_ignoreCase') === 'true';

$('wide').checked =
    localStorage.getItem('pll_wide') === 'true';

$('variants').checked =
    localStorage.getItem('pll_variants') === 'true';

// Sau F5: khôi phục kết quả lọc nếu trước đó đã lọc;
// nếu chưa lọc thì hiển thị toàn bộ danh sách.
if (localStorage.getItem('pll_hasFiltered') === 'true') {
    try {
        const saved = JSON.parse(localStorage.getItem('pll_kept') || '[]');

        if (Array.isArray(saved)) {
            kept = saved;
            hasFiltered = true;

            const total = $('source').value
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean).length;

            $('total').textContent = total;
            $('remaining').textContent = kept.length;
            $('removed').textContent = total - kept.length;

            $('summary').textContent =
                `Đã khôi phục kết quả lọc: còn ${kept.length}/${total} công thức.`;

            $('message').textContent = '';
            renderFormulas(kept);
        } else {
            showAllFormulas();
        }
    } catch {
        showAllFormulas();
    }
} else {
    showAllFormulas();
}


const moveSymbols = [
    'R', 'L', 'U', 'D', 'F', 'B',
    'r', 'l', 'u', 'd', 'f', 'b',
    'M', 'E', 'S', 'x', 'y', 'z'
];

const defaultWeights = Object.fromEntries(
    moveSymbols.map(symbol => [
        symbol,
        1
        // ['B', 'D', 'b', 'd'].includes(symbol) ? 2 : 1
    ])
);

let moveWeights = { ...defaultWeights };

function buildWeightTable() {
    const tbody = $('weightTableBody');
    tbody.replaceChildren();

    for (let i = 0; i < moveSymbols.length; i += 2) {
        const tr = document.createElement('tr');

        for (const symbol of moveSymbols.slice(i, i + 2)) {
            const tdSymbol = document.createElement('td');
            tdSymbol.textContent = symbol;

            const tdWeight = document.createElement('td');
            const input = document.createElement('input');

            input.type = 'number';
            input.min = '0';
            input.max = '1000';
            input.step = '1';
            input.value = moveWeights[symbol];
            input.dataset.symbol = symbol;
            input.setAttribute('aria-label', `Trọng số ${symbol}`);

            input.addEventListener('change', () => {
                const value = Number(input.value);

                moveWeights[symbol] =
                    Number.isFinite(value) && value >= 0
                        ? Math.min(1000, Math.floor(value))
                        : 1;

                input.value = moveWeights[symbol];

                localStorage.setItem(
                    'pll_moveWeights',
                    JSON.stringify(moveWeights)
                );

                updateLengthRange(true);
            });

            tdWeight.appendChild(input);
            tr.append(tdSymbol, tdWeight);
        }

        tbody.appendChild(tr);
    }
}

// R' và R2 có cùng trọng số với R.
// Ký hiệu chưa có trong bảng mặc định trọng số 1.
function formulaWeight(line) {
    return getTokens(line).reduce((sum, token) => {
        const symbol = token.replace(/(?:2|')+$/g, '');
        const weight = Object.hasOwn(moveWeights, symbol)
            ? moveWeights[symbol]
            : 1;

        return sum + weight;
    }, 0);
}

function getInputFormulas() {
    return $('source').value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}

function getFormulasPassingSymbolFilter() {
    const lines = getInputFormulas();
    const banned = getBanned();
    const ignoreCase = $('ignoreCase').checked;
    const allowXYZFirst = $('allowXYZFirst').checked;

    return lines.filter(line => {
        const tokens = getTokens(line);

        return !tokens.some((token, index) => {
            if (allowXYZFirst && index === 0) {
                if (/^[xyz](?:2|')?$/i.test(token)) {
                    return false;
                }
            }

            const key = ignoreCase ? token.toLowerCase() : token;
            return banned.has(key);
        });
    });
}

function updateLengthRange(resetToDataRange = false, changedId = null) {
    const formulas = getFormulasPassingSymbolFilter();
    const lengths = formulas.map(formulaWeight);

    const dataMin = lengths.length ? Math.min(...lengths) : 0;
    const dataMax = lengths.length ? Math.max(...lengths) : 0;

    const minSlider = $('minLength');
    const maxSlider = $('maxLength');

    // Giới hạn thanh kéo theo độ dài thực tế của danh sách
    const sliderMax = Math.max(dataMax, dataMin + 1);

    minSlider.min = dataMin;
    maxSlider.min = dataMin;
    minSlider.max = sliderMax;
    maxSlider.max = sliderMax;

    let minValue = Number(minSlider.value);
    let maxValue = Number(maxSlider.value);

    // Khi dán công thức mới hoặc đổi trọng số:
    // cập nhật khoảng chọn theo độ dài mới tính được.
    if (resetToDataRange) {
        minValue = dataMin;
        maxValue = dataMax;
    } else {
        minValue = Math.max(dataMin, Math.min(dataMax, minValue));
        maxValue = Math.max(dataMin, Math.min(dataMax, maxValue));

        if (minValue > maxValue) {
            if (changedId === 'minLength') {
                maxValue = minValue;
            } else {
                minValue = maxValue;
            }
        }
    }

    minSlider.value = minValue;
    maxSlider.value = maxValue;

    $('minLengthValue').textContent = minValue;
    $('maxLengthValue').textContent = maxValue;

    const range = Math.max(1, sliderMax - dataMin);
    const left = ((minValue - dataMin) / range) * 100;
    const right = ((maxValue - dataMin) / range) * 100;

    $('rangeSelected').style.left = `${left}%`;
    $('rangeSelected').style.width = `${Math.max(0, right - left)}%`;

    $('lengthInfo').textContent = formulas.length
        ? `Có ${formulas.length} công thức. Độ dài thực tế: ${dataMin}–${dataMax}.`
        : 'Dán công thức để xác định khoảng độ dài.';

    localStorage.setItem('pll_minLength', minValue);
    localStorage.setItem('pll_maxLength', maxValue);
}

$('minLength').addEventListener('input', () => {
    updateLengthRange(false, 'minLength');
});

$('maxLength').addEventListener('input', () => {
    updateLengthRange(false, 'maxLength');
});


$('resetWeights').addEventListener('click', () => {
    moveWeights = { ...defaultWeights };

    localStorage.setItem(
        'pll_moveWeights',
        JSON.stringify(moveWeights)
    );

    updateLengthRange(true);
    showAllFormulas();
});

// Khôi phục bảng trọng số đã chỉnh sửa
try {
    const savedWeights = JSON.parse(
        localStorage.getItem('pll_moveWeights') || '{}'
    );

    for (const symbol of moveSymbols) {
        const value = Number(savedWeights[symbol]);

        if (
            Object.hasOwn(savedWeights, symbol) &&
            Number.isFinite(value) &&
            value >= 0
        ) {
            moveWeights[symbol] = Math.min(1000, Math.floor(value));
        }
    }
} catch {
    moveWeights = { ...defaultWeights };
}

buildWeightTable();

const savedMinLength = localStorage.getItem('pll_minLength');
const savedMaxLength = localStorage.getItem('pll_maxLength');

if (savedMinLength !== null) {
    $('minLength').value = savedMinLength;
}

if (savedMaxLength !== null) {
    $('maxLength').value = savedMaxLength;
}

// Chỉ cập nhật sau khi moveWeights đã được khởi tạo
updateLengthRange();
