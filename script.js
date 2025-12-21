import { hotels } from './data.js';

const grid = document.getElementById('hotelGrid');
const noResults = document.getElementById('noResults');
const priceRange = document.getElementById('priceRange');
const priceDisplay = document.getElementById('priceDisplay');
const sizeFilter = document.getElementById('sizeFilter');
const cancelableOnly = document.getElementById('cancelableOnly');

// 篩選控制項
const redLightFilter = document.getElementById('redLightFilter');
const poorSoundproofingFilter = document.getElementById('poorSoundproofingFilter');
const sofaBedFilter = document.getElementById('sofaBedFilter');
const noBaggageFilter = document.getElementById('noBaggageFilter');
const fewOutletsFilter = document.getElementById('fewOutletsFilter');

function renderHotels() {
    const maxPrice = parseInt(priceRange.value);
    const minSize = parseInt(sizeFilter.value);
    const showCancelableOnly = cancelableOnly.checked;

    const filtered = hotels.filter(h => {
        const priceMatch = h.price <= maxPrice;
        const sizeMatch = h.size >= minSize || (minSize === 0);
        const cancelMatch = !showCancelableOnly || h.cancelable;
        
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
            
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' Singapore')}`;

            // 樣式統一化函式：仿照「不可取消」的 text-slate-400 與佈局
            const getFeatureRow = (val, label) => {
                const isTrue = val === true;
                const displayText = val === undefined ? `${label}: 未提供` : (isTrue ? label : `非${label}`);
                // 如果是 true，則使用較深色，如果是 false/undefined 則使用跟「不可取消」一樣的 slate-400
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
                        <div class="flex items-center text-sm ${h.cancelable ? 'text-green-600' : 'text-slate-400'}">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${h.cancelable ? '可取消' : '不可取消'}
                        </div>

                        <div class="flex items-center text-sm text-slate-600">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                            ${h.size > 0 ? h.size + ' 平方公尺' : '未提供空間資訊'}
                        </div>

                        ${getFeatureRow(h.isRedLightDistrict, '靠近紅燈區')}
                        ${getFeatureRow(h.isPoorSoundproofing, '隔音差')}
                        ${getFeatureRow(h.hasSofaBed, '沙發床')}
                        ${getFeatureRow(h.hasNoBaggageStorage, '無行李寄放')}
                        ${getFeatureRow(h.hasFewOutlets, '插座少')}
                    </div>
                </div>
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span class="text-xs text-slate-500 italic">${h.note || ''}</span>
                    <a href="${mapUrl}" target="_blank" class="text-blue-600 font-semibold text-sm hover:underline flex items-center">
                        查看地圖
                        <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

// 監聽器
[priceRange, sizeFilter, cancelableOnly, redLightFilter, poorSoundproofingFilter, sofaBedFilter, noBaggageFilter, fewOutletsFilter].forEach(el => {
    if (el) el.addEventListener(el.id === 'priceRange' ? 'input' : 'change', (e) => {
        if (el.id === 'priceRange') priceDisplay.textContent = `$${parseInt(e.target.value).toLocaleString()}`;
        renderHotels();
    });
});

renderHotels();