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
const wifiFilter = document.getElementById('wifiFilter');
const poolFilter = document.getElementById('poolFilter');
const washerFilter = document.getElementById('washerFilter');

// --- 地理編碼與緩存相關 ---
const CACHE_KEY = 'hotel_coords_cache_v1';
let coordsCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
let markerLayer = L.layerGroup();
let currentFilteredHotels = [];

function saveCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(coordsCache));
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    coordsCache = {};
    location.reload();
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCoordinates(name) {
    if (coordsCache[name]) return coordsCache[name];

    try {
        // Nominatim API 規範：頻率不得超過每秒 1 次
        // 在瀏覽器端 fetch 無法自定義 User-Agent，通常使用預設瀏覽器標頭即可
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ' Singapore')}&format=json&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            const result = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
            coordsCache[name] = result;
            saveCache();
            return result;
        }
    } catch (e) {
        console.error(`地理編碼失敗 (${name}):`, e);
    }
    return null;
}

async function geocodeAllHotels() {
    for (const h of hotels) {
        // 優先權：1. 手動座標 > 2. 快取座標 > 3. 即時查詢
        if (h.lat && h.lon) {
            coordsCache[h.name] = { lat: h.lat, lon: h.lon };
            updateMapMarkers();
            if (!debugPanel.classList.contains('hidden')) renderDebugList();
            continue;
        }

        if (!coordsCache[h.name]) {
            console.log(`正在獲取 ${h.name} 的座標...`);
            await getCoordinates(h.name);
            updateMapMarkers(); // 每成功獲取一個就更新一次地圖（若地圖已初始化）
            if (!debugPanel.classList.contains('hidden')) renderDebugList(); // 若偵錯面板開啟則更新內容
            await delay(1200); // 稍微超過 1 秒以符合 Nominatim 政策
        }
    }
}

function updateMapMarkers() {
    if (!map) return;

    markerLayer.clearLayers();

    // 將飯店按座標分組
    const groups = {};
    currentFilteredHotels.forEach(h => {
        // 優先使用手動座標，其次才是快取
        const coords = (h.lat && h.lon) ? { lat: h.lat, lon: h.lon } : coordsCache[h.name];
        if (coords) {
            const key = `${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`; // 使用小數點後六位作為 key 以處理微小差異
            if (!groups[key]) {
                groups[key] = {
                    coords: coords,
                    hotels: []
                };
            }
            groups[key].hotels.push(h);
        }
    });

    // 為每個座標組創建標記
    Object.values(groups).forEach(group => {
        const marker = L.marker([group.coords.lat, group.coords.lon]);

        let popupContent = `<div class="p-1 min-w-[200px] max-w-[280px] max-h-[400px] overflow-y-auto">`;

        if (group.hotels.length > 1) {
            popupContent += `
                <div class="sticky top-0 bg-white border-b mb-2 pb-2 z-10">
                    <h3 class="font-bold text-sm text-blue-600 flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        此處有 ${group.hotels.length} 間符合條件的飯店
                    </h3>
                </div>
            `;
        }

        group.hotels.forEach((h, index) => {
            const isMultiple = group.hotels.length > 1;
            popupContent += `
                <div class="${index > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}">
                    <div class="flex justify-between items-start gap-2">
                        <h4 class="${isMultiple ? 'text-sm' : 'text-lg'} font-bold text-slate-800 leading-tight">${h.name}</h4>
                        <span class="bg-blue-50 text-blue-700 ${isMultiple ? 'text-[10px]' : 'text-xs'} px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                            $${h.price.toLocaleString()}
                        </span>
                    </div>
                    
                    <div class="${isMultiple ? 'text-[11px]' : 'text-sm'} text-slate-600 mt-1 space-y-1">
                        <div class="flex items-center">
                            <svg class="w-3 h-3 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5" />
                            </svg>
                            空間: ${h.size} m²
                        </div>
                        ${h.note ? `
                            <div class="text-slate-500 italic leading-snug bg-slate-50 p-1.5 rounded mt-1 border border-slate-100">
                                ${h.note}
                            </div>
                        ` : ''}
                    </div>

                    <a href="https://www.google.com/maps/search/${encodeURIComponent(h.name + ' Singapore')}" 
                       target="_blank" 
                       class="block w-full text-center bg-blue-600 !text-white text-[10px] py-1.5 rounded mt-2 hover:bg-blue-700 transition-colors font-bold shadow-sm"
                       style="color: white !important;">
                       Google Maps 查看
                    </a>
                </div>
            `;
        });

        popupContent += `</div>`;

        marker.bindPopup(popupContent);
        marker.addTo(markerLayer);
    });

    if (!map.hasLayer(markerLayer)) {
        markerLayer.addTo(map);
    }
}

// --- 介面渲染 ---

function renderHotels() {
    const maxPrice = parseInt(priceRange.value);
    const minSize = parseInt(sizeFilter.value);
    const showCancelableOnly = cancelableOnly.checked;

    currentFilteredHotels = hotels.filter(h => {
        const priceMatch = h.price <= maxPrice;
        const sizeMatch = h.size >= minSize || (minSize === 0);
        const cancelMatch = !showCancelableOnly || h.cancelable;

        const safeAreaMatch = !safeAreaFilter.checked || (h.isRedLightDistrict === false);
        const goodSoundMatch = !goodSoundFilter.checked || (h.isPoorSoundproofing === false);
        const realBedMatch = !realBedFilter.checked || (h.hasSofaBed === false);
        const baggageMatch = !hasBaggageFilter.checked || (h.hasNoBaggageStorage === false);
        const outletMatch = !plentyOutletsFilter.checked || (h.hasFewOutlets === false);
        const wifiMatch = !wifiFilter.checked || h.hasWiFi;
        const poolMatch = !poolFilter.checked || h.hasPool;
        const washerMatch = !washerFilter.checked || h.hasWashingMachine;

        return priceMatch && sizeMatch && cancelMatch &&
            safeAreaMatch && goodSoundMatch &&
            realBedMatch && baggageMatch && outletMatch &&
            wifiMatch && poolMatch && washerMatch;
    });

    grid.innerHTML = '';

    if (currentFilteredHotels.length === 0) {
        noResults.classList.remove('hidden');
    } else {
        noResults.classList.add('hidden');
        currentFilteredHotels.forEach(h => {
            const card = document.createElement('div');
            card.className = 'hotel-card bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col';

            const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(h.name + ' Singapore')}`;

            const features = [
                { val: h.cancelable === false ? true : (h.cancelable === true ? false : undefined), label: '不可取消' },
                { val: h.isRedLightDistrict, label: '靠近紅燈區' },
                { val: h.isPoorSoundproofing, label: '隔音差' },
                { val: h.hasSofaBed, label: '沙發床' },
                { val: h.hasNoBaggageStorage, label: '無行李寄放' },
                { val: h.hasFewOutlets, label: '插座少' },
                { val: h.hasWiFi, label: 'WiFi', isPositive: true },
                { val: h.hasPool, label: '游泳池', isPositive: true },
                { val: h.hasWashingMachine, label: '洗衣機', isPositive: true },
            ];

            features.sort((a, b) => {
                const getPriority = (v) => {
                    if (v === true) return 1;
                    if (v === false) return 2;
                    return 3;
                };
                return getPriority(a.val) - getPriority(b.val);
            });

            const getFeatureHTML = (f) => {
                let colorClass = 'text-slate-400';
                let displayText = `${f.label}: 無資訊`;
                let iconPath = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

                if (f.val === true) {
                    if (f.isPositive) {
                        colorClass = 'text-slate-800';
                        displayText = f.label;
                        iconPath = 'M5 13l4 4L19 7';
                    } else {
                        colorClass = 'text-amber-600 font-bold';
                        displayText = f.label;
                        iconPath = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
                    }
                } else if (f.val === false) {
                    if (f.isPositive) {
                        // 如果明確寫了 false，顯示「無」
                        colorClass = 'text-slate-400';
                        displayText = `${f.label}: 無`;
                        iconPath = 'M6 18L18 6M6 6l12 12';
                    } else {
                        colorClass = 'text-slate-800';
                        if (f.label === '不可取消') {
                            displayText = '可免費取消';
                        } else {
                            displayText = `非${f.label}`;
                        }
                        iconPath = 'M5 13l4 4L19 7';
                    }
                } else {
                    // f.val 為 undefined，保持預設的「未提供」
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

    // 當列表更新時，同步更新地圖標記
    updateMapMarkers();
}

// 監聽器
const allFilters = [
    priceRange, sizeFilter, cancelableOnly,
    safeAreaFilter, goodSoundFilter, realBedFilter,
    hasBaggageFilter, plentyOutletsFilter,
    wifiFilter, poolFilter, washerFilter
];

allFilters.forEach(el => {
    if (el) {
        el.addEventListener(el.id === 'priceRange' ? 'input' : 'change', (e) => {
            if (el.id === 'priceRange') priceDisplay.textContent = `$${parseInt(e.target.value).toLocaleString()}`;
            renderHotels();
        });
    }
});

// --- 地圖相關邏輯 ---
const viewToggleBtn = document.getElementById('viewToggleBtn');
const mainContent = document.getElementById('mainContent');
const mapContainer = document.getElementById('mapContainer');
const toggleText = document.getElementById('toggleText');
const toggleIcon = document.getElementById('toggleIcon');

let map = null;
let isMapView = false;

viewToggleBtn.addEventListener('click', () => {
    isMapView = !isMapView;

    if (isMapView) {
        mainContent.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        toggleText.textContent = '返回列表';
        toggleIcon.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
        `;

        setTimeout(() => {
            initMap();
            updateMapMarkers();
        }, 100);
    } else {
        mainContent.classList.remove('hidden');
        mapContainer.classList.add('hidden');
        toggleText.textContent = '查看地圖';
        toggleIcon.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-1.447-.894L15 7m0 10V7" />
            </svg>
        `;
    }
});

function initMap() {
    if (map) {
        map.invalidateSize();
        return;
    }

    map = L.map('map').setView([1.3521, 103.8198], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 新增：紅燈區範圍標示 (芽籠 Lor 4 - Lor 40 區域)
    const redLightDistrictPoints = [
        [1.3115, 103.8728], // 西南 (Geylang Rd / Sims Way)
        [1.3150, 103.8915], // 東南 (Geylang Rd / Lor 40)
        [1.3175, 103.8910], // 東北 (Sims Ave / Lor 40)
        [1.3140, 103.8720]  // 西北 (Sims Ave / Sims Way)
    ];

    L.polygon(redLightDistrictPoints, {
        color: '#ff0000',
        fillColor: '#ff0000',
        fillOpacity: 0.3,
        weight: 1,
        stroke: true,
        dashArray: '5, 5'
    }).addTo(map).bindTooltip("芽籠紅燈區 (Geylang Red Light District)", { sticky: true });

    fetch('https://raw.githubusercontent.com/cheeaun/sgraildata/master/data/v1/sg-rail.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                filter: function (feature) {
                    return feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString';
                },
                style: function (feature) {
                    const props = feature.properties || {};
                    const lineName = props.name || '';
                    const stationColors = props.station_colors || '';

                    let color = '#748477';

                    if (stationColors.includes('red') || lineName.includes('North South')) color = '#d42e12';
                    else if (stationColors.includes('green') || lineName.includes('East West')) color = '#009645';
                    else if (stationColors.includes('purple') || lineName.includes('North East')) color = '#800080';
                    else if (stationColors.includes('yellow') || stationColors.includes('orange') || lineName.includes('Circle')) color = '#ff9a00';
                    else if (stationColors.includes('blue') || lineName.includes('Downtown')) color = '#005ec4';
                    else if (stationColors.includes('brown') || lineName.includes('Thomson')) color = '#733104';

                    return {
                        color: color,
                        weight: 2,
                        opacity: 0.5,
                        lineCap: 'round',
                        lineJoin: 'round'
                    };
                }
            }).addTo(map);
        })
        .catch(err => console.error('無法載入捷運路線數據:', err));
}

// --- 偵錯相關功能 ---
const debugPanel = document.getElementById('debugPanel');
const debugList = document.getElementById('debugList');
const closeDebugBtn = document.getElementById('closeDebugBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const pageTitle = document.querySelector('header h1');

let clickCount = 0;
let clickTimer = null;

if (pageTitle) {
    pageTitle.addEventListener('click', () => {
        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 500);

        if (clickCount === 3) {
            showDebugPanel();
            clickCount = 0;
        }
    });
}

function showDebugPanel() {
    debugPanel.classList.remove('hidden');
    renderDebugList();
}

function renderDebugList() {
    debugList.innerHTML = '';

    hotels.forEach(h => {
        const isManual = h.lat && h.lon;
        const coords = isManual ? { lat: h.lat, lon: h.lon } : coordsCache[h.name];

        const statusItem = document.createElement('div');
        statusItem.className = 'p-4 rounded-xl border flex items-center justify-between ' +
            (coords ? (isManual ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100') : 'bg-rose-50 border-rose-100');

        statusItem.innerHTML = `
            <div>
                <div class="font-bold text-slate-800">
                    ${h.name}
                    ${isManual ? '<span class="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">手動提供</span>' : ''}
                </div>
                <div class="text-xs ${coords ? (isManual ? 'text-blue-600' : 'text-emerald-600') : 'text-rose-600'} mt-1">
                    ${coords ? `座標: ${coords.lat}, ${coords.lon}` : '⚠️ 查無座標'}
                </div>
            </div>
            ${!coords ? `
                <a href="https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(h.name + ' Singapore')}&format=json" 
                   target="_blank" 
                   class="text-xs bg-rose-200 text-rose-800 px-3 py-1.5 rounded-lg hover:bg-rose-300 font-bold">
                   手動測試 Nominatim
                </a>
            ` : ''}
        `;
        debugList.appendChild(statusItem);
    });
}

closeDebugBtn.addEventListener('click', () => {
    debugPanel.classList.add('hidden');
});

clearCacheBtn.addEventListener('click', () => {
    if (confirm('確定要清除所有快取的座標資訊並重新查詢嗎？')) {
        clearCache();
    }
});

// 初始啟動
renderHotels();
geocodeAllHotels(); // 背景開始獲取座標
