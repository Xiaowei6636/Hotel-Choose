import { hotels } from './data.js';

// 取得 DOM 元素
const grid = document.getElementById('hotelGrid');
const noResults = document.getElementById('noResults');
const priceRange = document.getElementById('priceRange');
const priceDisplay = document.getElementById('priceDisplay');
const sizeFilter = document.getElementById('sizeFilter');
const cancelableOnly = document.getElementById('cancelableOnly');

// 新增的篩選控制項
const redLightFilter = document.getElementById('redLightFilter');
const poorSoundproofingFilter = document.getElementById('poorSoundproofingFilter');
const sofaBedFilter = document.getElementById('sofaBedFilter');
const noBaggageFilter = document.getElementById('noBaggageFilter');
const fewOutletsFilter = document.getElementById('fewOutletsFilter');

/**
 * 輔助函式：處理布林值顯示
 * @param {boolean|undefined} val - 資料庫中的布林值
 * @param {string} trueText - 為 true 時顯示的文字
 * @param {string} falseText - 為 false 時顯示的文字
 * @param {string} accentClass - 強調顏色 (預設為橘色)
 */
function getStatusHTML(val, trueText, falseText, accentClass = 'text-orange-600') {
    if (val === undefined || val === null) {
        return `<span class="text-slate-400">未提供資訊</span>`;
    }
    return val 
        ? `<span class="${accentClass} font-medium">${trueText}</span>` 
        : `<span class="text-slate-500">${falseText}</span>`;
}

function renderHotels() {
    const maxPrice = parseInt(priceRange.value);
    const minSize = parseInt(sizeFilter.value);
    const showCancelableOnly = cancelableOnly.checked;

    const filtered = hotels.filter(h => {
        // 基礎篩選
        const priceMatch = h.price <= maxPrice;
        const sizeMatch = h.size >= minSize || (minSize === 0);
        const cancelMatch = !showCancelableOnly || h.cancelable;
        
        // 新增進階篩選 (只有當勾選框被選中時，才過濾出具備該特徵的飯店)
        const redLightMatch = !redLightFilter.checked || h.isRedLightDistrict;
        const soundproofingMatch = !poorSoundproofingFilter.checked || h.isPoorSoundproofing;
        const sofaBedMatch = !sofaBedFilter.checked || h.hasSofaBed;
        const baggageMatch = !noBaggageFilter.checked || h.hasNoBaggageStorage;
        const outletMatch = !fewOutletsFilter.checked || h.hasFewOutlets;

        return priceMatch && sizeMatch && cancelMatch && 
               redLightMatch && soundproofingMatch && 
               sofaBedMatch && baggageMatch && outletMatch;
    });

    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        noResults.classList.remove('hidden');
    } else {
        noResults.classList.add('hidden');
        filtered.forEach(h => {
            const card = document.createElement('div');
            card.className = 'hotel-card bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col';
            
            // 修正 Template Literals URL 格式
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' Singapore')}`;

            card.innerHTML = `
                <div class="p-5 flex-grow">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-slate-800">${h.name}</h3>
                        <span class="bg-blue-50 text-blue-700 text-sm px-2 py-1 rounded font-medium">$${h.price.toLocaleString()}</span>
                    </div>

                    <div class="grid grid-cols-1 gap-1 mt-3 mb-4 p-3 bg-slate-50 rounded-lg text-xs">
                        <div class="flex justify-between">
                            <span class="text-slate-500">紅燈區週邊</span>
                            ${getStatusHTML(h.isRedLightDistrict, '🚩 是', '✅ 否')}
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">隔音狀況</span>
                            ${getStatusHTML(h.isPoorSoundproofing, '🔈 較差', '🔇 良好')}
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">房內沙發床</span>
                            ${getStatusHTML(h.hasSofaBed, '🛋️ 有', '🛏️ 無')}
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">行李寄放</span>
                            ${getStatusHTML(h.hasNoBaggageStorage, '❌ 無提供', '📦 有提供', 'text-red-600')}
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">插座數量</span>
                            ${getStatusHTML(h.hasFewOutlets, '🔌 偏少', '🔌 充足')}
                        </div>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="flex items-center text-sm ${h.cancelable ? 'text-green-600' : 'text-slate-400'}">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${h.cancelable ? '可取消預訂' : '不可取消'}
                        </div>
                        <div class="flex items-center text-sm text-slate-600">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                            ${h.size > 0 ? h.size + ' 平方公尺' : '未提供空間資訊'}
                        </div>
                    </div>
                </div>
                
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span class="text-xs text-slate-500 italic">${h.note || ''}</span>
                    <a href="${mapUrl}" 
                       target="_blank" 
                       class="text-blue-600 font-semibold text-sm hover:underline flex items-center">
                        查看地圖
                        <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

// 事件監聽：基礎篩選
priceRange.addEventListener('input', (e) => {
    priceDisplay.textContent = `$${parseInt(e.target.value).toLocaleString()}`;
    renderHotels();
});

sizeFilter.addEventListener('change', renderHotels);
cancelableOnly.addEventListener('change', renderHotels);

// 事件監聽：新增的進階布林篩選
const advancedFilters = [
    redLightFilter, 
    poorSoundproofingFilter, 
    sofaBedFilter, 
    noBaggageFilter, 
    fewOutletsFilter
];

advancedFilters.forEach(filter => {
    if (filter) { // 確保元素存在，避免 HTML 沒寫時報錯
        filter.addEventListener('change', renderHotels);
    }
});

// 初始渲染
renderHotels();