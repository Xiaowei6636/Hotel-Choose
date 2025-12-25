import { hotels } from './data.js';

const grid = document.getElementById('hotelGrid');
const noResults = document.getElementById('noResults');
const priceRange = document.getElementById('priceRange');
const priceDisplay = document.getElementById('priceDisplay');
const sizeFilter = document.getElementById('sizeFilter');
const cancelableOnly = document.getElementById('cancelableOnly');

// 取得優選篩選控制項 (ID 已更新為正面表述)
const safeAreaFilter = document.getElementById('safeAreaFilter');
const goodSoundFilter = document.getElementById('goodSoundFilter');
const realBedFilter = document.getElementById('realBedFilter');
const hasBaggageFilter = document.getElementById('hasBaggageFilter');
const plentyOutletsFilter = document.getElementById('plentyOutletsFilter');

function renderHotels() {
    const maxPrice = parseInt(priceRange.value);
    const minSize = parseInt(sizeFilter.value);
    const showCancelableOnly = cancelableOnly.checked;

    const filtered = hotels.filter(h => {
        // 1. 基礎篩選
        const priceMatch = h.price <= maxPrice;
        const sizeMatch = h.size >= minSize || (minSize === 0);
        const cancelMatch = !showCancelableOnly || h.cancelable;
        
        // 2. 優選篩選邏輯 (反轉邏輯)：
        // 當勾選時，飯店必須滿足：屬性已定義 (!== undefined) 且 值為 false (表示沒有該負面特徵)
        const safeAreaMatch = !safeAreaFilter.checked || (h.isRedLightDistrict !== undefined && h.isRedLightDistrict === false);
        const goodSoundMatch = !goodSoundFilter.checked || (h.isPoorSoundproofing !== undefined && h.isPoorSoundproofing === false);
        const realBedMatch = !realBedFilter.checked || (h.hasSofaBed !== undefined && h.hasSofaBed === false);
        const baggageMatch = !hasBaggageFilter.checked || (h.hasNoBaggageStorage !== undefined && h.hasNoBaggageStorage === false);
        const outletMatch = !plentyOutletsFilter.checked || (h.hasFewOutlets !== undefined && h.hasFewOutlets === false);

        return priceMatch && sizeMatch && cancelMatch && 
               safeAreaMatch && goodSoundMatch && 
               realBedMatch && baggageMatch && outletMatch;
    });

    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        noResults.classList.remove('hidden');
    } else {
        noResults.classList.add('hidden');
        filtered.forEach(h => {
            const card = document.createElement('div');
            card.className = 'hotel-card bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col';
            
            // 修正 Template Literals 的 URL 格式
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' Singapore')}`;

            // 樣式統一化函式：顯示負面狀態，樣式仿照「不可取消」
            const getFeatureRow = (val, label) => {
                const isTrue = val === true;
                // 如果值是 true，顯示該負面標籤；如果是 false，顯示「非...」；如果是 undefined，顯示「未提供」
                const displayText = val === undefined ? `${label}: 未提供` : (isTrue ? label : `非${label}`);
                // 只有確定有負面狀況 (true) 時顏色稍深，其餘 (false/undefined) 皆使用與「不可取消」相同的 slate-400
                const colorClass = isTrue ? 'text-slate-600' : 'text-slate-400';
                
                return `
                    <div class="flex items-center text-sm ${colorClass}">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        ${displayText}
                    </div>
                `;
            };

            card.innerHTML = `
                <div class="p-5 flex-grow">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-slate-800">${h.name}</h3>
                        <span class="bg-blue-50 text-blue-700 text-sm px-2 py-1 rounded font-medium">$${h.price.toLocaleString()}</span>
                    </div>
                    
                    <div class="space-y-2 mt-4">

                        <div class="flex items-center text-sm text-slate-600">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                            ${h.size > 0 ? h.size + ' 平方公尺' : '未提供空間資訊'}
                        </div>

                        <div class="flex items-center text-sm ${h.cancelable ? 'text-green-600' : 'text-slate-400'}">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${h.cancelable ? '可取消' : '不可取消'}
                        </div>


                        ${getFeatureRow(h.isRedLightDistrict, '靠近紅燈區')}
                        ${getFeatureRow(h.isPoorSoundproofing, '隔音差')}
                        ${getFeatureRow(h.hasSofaBed, '沙發床')}
                        ${getFeatureRow(h.hasNoBaggageStorage, '無行李寄放')}
                        ${getFeatureRow(h.hasFewOutlets, '插座少')}
                    </div>
                </div>
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-4">
                    <span class="text-xs text-slate-500 italic truncate flex-grow" title="${h.note || ''}">
                        ${h.note || ''}
                    </span>
                    
                    <a href="${mapUrl}" target="_blank" class="text-blue-600 font-semibold text-sm hover:underline flex items-center whitespace-nowrap flex-shrink-0">
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

// 監聽器
const allFilters = [
    priceRange, sizeFilter, cancelableOnly, 
    safeAreaFilter, goodSoundFilter, realBedFilter, 
    hasBaggageFilter, plentyOutletsFilter
];

allFilters.forEach(el => {
    if (el) {
        el.addEventListener(el.id === 'priceRange' ? 'input' : 'change', (e) => {
            if (el.id === 'priceRange') priceDisplay.textContent = `$${parseInt(e.target.value).toLocaleString()}`;
            renderHotels();
        });
    }
});

// 初始渲染
renderHotels();
