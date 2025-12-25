import { hotels } from './data.js';

const grid = document.getElementById('hotelGrid');
const noResults = document.getElementById('noResults');
const priceRange = document.getElementById('priceRange');
const priceDisplay = document.getElementById('priceDisplay');
const sizeFilter = document.getElementById('sizeFilter');
const cancelableOnly = document.getElementById('cancelableOnly');

const safeAreaFilter = document.getElementById('safeAreaFilter');
const goodSoundFilter = document.getElementById('goodSoundFilter');
const realBedFilter = document.getElementById('realBedFilter');
const hasBaggageFilter = document.getElementById('hasBaggageFilter');
const plentyOutletsFilter = document.getElementById('plentyOutletsFilter');
const hasParkingFilter = document.getElementById('hasParkingFilter');

function renderHotels() {
    const maxPrice = parseInt(priceRange.value);
    const minSize = parseInt(sizeFilter.value);
    const showCancelableOnly = cancelableOnly.checked;

    const filtered = hotels.filter(h => {
        const priceMatch = h.price <= maxPrice;
        const sizeMatch = h.size >= minSize || (minSize === 0);
        const cancelMatch = !showCancelableOnly || h.cancelable;

        const safeAreaMatch = !safeAreaFilter.checked || (h.isRedLightDistrict === false);
        const goodSoundMatch = !goodSoundFilter.checked || (h.isPoorSoundproofing === false);
        const realBedMatch = !realBedFilter.checked || (h.hasSofaBed === false);
        const baggageMatch = !hasBaggageFilter.checked || (h.hasNoBaggageStorage === false);
        const outletMatch = !plentyOutletsFilter.checked || (h.hasFewOutlets === false);
        const parkingMatch = !hasParkingFilter.checked || (h.hasNoParking === false);

        return priceMatch && sizeMatch && cancelMatch &&
            safeAreaMatch && goodSoundMatch &&
            realBedMatch && baggageMatch && outletMatch && parkingMatch;
    });

    grid.innerHTML = '';

    if (filtered.length === 0) {
        noResults.classList.remove('hidden');
    } else {
        noResults.classList.add('hidden');
        filtered.forEach(h => {
            const card = document.createElement('div');
            card.className = 'hotel-card bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col';

            // 修正 Map URL 的 Template Literal
            const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(h.name + ' Singapore')}`;

            // 1. 定義要顯示的特徵資料 (將 cancelable 整合進來)
            // 將「不可取消」視為 true (負面)，這樣才能統一排序邏輯
            const features = [
                { val: h.cancelable === false ? true : (h.cancelable === true ? false : undefined), label: '不可取消' },
                { val: h.isRedLightDistrict, label: '靠近紅燈區' },
                { val: h.isPoorSoundproofing, label: '隔音差' },
                { val: h.hasSofaBed, label: '沙發床' },
                { val: h.hasNoBaggageStorage, label: '無行李寄放' },
                { val: h.hasFewOutlets, label: '插座少' },
                { val: h.hasNoParking, label: '免費停車' }
            ];

            // 2. 排序邏輯：負面 (true) > 正面 (false) > 未提供 (undefined)
            features.sort((a, b) => {
                const getPriority = (v) => {
                    if (v === true) return 1;    // 負面資訊排第一
                    if (v === false) return 2;   // 正面資訊排第二
                    return 3;                    // undefined 排最後
                };
                return getPriority(a.val) - getPriority(b.val);
            });

            // 3. 產生特徵 HTML 的輔助函式
            const getFeatureHTML = (f) => {
                let colorClass = 'text-slate-400';
                let displayText = `${f.label}: 未提供`;
                let iconPath = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

                if (f.val === true) {
                    colorClass = 'text-amber-600 font-bold';
                    displayText = f.label;
                    iconPath = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
                } else if (f.val === false) {
                    colorClass = 'text-slate-800';
                    // 針對標籤做反轉優化顯示
                    if (f.label === '不可取消') {
                        displayText = '可免費取消';
                    } else if (f.label === '免費停車') {
                        displayText = '有免費停車';
                    } else {
                        displayText = `非${f.label}`;
                    }
                    iconPath = 'M5 13l4 4L19 7';
                }

                return `
                    <div class="flex items-start text-sm ${colorClass}">
                        <svg class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                        </svg>
                        <span>${displayText}</span>
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
                        <div class="flex items-center text-sm text-slate-800 font-medium">
                            <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                            </svg>
                            ${h.size > 0 ? h.size + ' 平方公尺' : '未提供空間資訊'}
                        </div>

                        <hr class="border-slate-100 my-2">

                        <div class="space-y-2">
                            ${features.map(f => getFeatureHTML(f)).join('')}
                        </div>
                    </div>
                </div>
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-start gap-3">
                    <div class="text-xs text-slate-500 italic leading-relaxed">
                        ${h.note || ''}
                    </div>
                    
                    <a href="${mapUrl}" target="_blank" class="text-blue-600 font-semibold text-sm hover:underline flex items-center whitespace-nowrap flex-shrink-0 pt-0.5">
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
    hasBaggageFilter, plentyOutletsFilter, hasParkingFilter
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
