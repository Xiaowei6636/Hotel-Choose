import { hotels } from './data.js';
import { Octokit } from "https://esm.sh/@octokit/core";

const grid = document.getElementById('hotelGrid');
const noResults = document.getElementById('noResults');
const priceRange = document.getElementById('priceRange');
const priceDisplay = document.getElementById('priceDisplay');
const sizeFilter = document.getElementById('sizeFilter');
const cancelableOnly = document.getElementById('cancelableOnly');

const safeAreaFilter = document.getElementById('safeAreaFilter');
const goodSoundFilter = document.getElementById('goodSoundFilter');
const realBedFilter = document.getElementById('realBedFilter');
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
        const outletMatch = !plentyOutletsFilter.checked || (h.hasFewOutlets === false);
        const wifiMatch = !wifiFilter.checked || h.hasWiFi;
        const poolMatch = !poolFilter.checked || h.hasPool;
        const washerMatch = !washerFilter.checked || h.hasWashingMachine;

        return priceMatch && sizeMatch && cancelMatch &&
            safeAreaMatch && goodSoundMatch &&
            realBedMatch && outletMatch &&
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
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
                    <div class="flex items-center gap-4">
                        <a href="${mapUrl}" target="_blank" class="text-blue-600 font-semibold text-sm hover:underline flex items-center whitespace-nowrap">
                            查看地圖
                            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                        </a>
                        <button data-hotel-name="${h.name}" class="edit-btn hidden bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1 rounded-md hover:bg-slate-300">
                            編輯
                        </button>
                    </div>
                    <div class="text-xs text-slate-500 italic leading-relaxed text-right">
                        ${h.note || ''}
                    </div>
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
    plentyOutletsFilter,
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

// --- GitHub Auth & UI Logic ---

const TOKEN_COOKIE = 'github_pat';

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userLogin = document.getElementById('user-login');
const patModal = document.getElementById('pat-modal');

async function updateLoginState() {
    const token = Cookies.get(TOKEN_COOKIE);
    const editButtons = document.querySelectorAll('.edit-btn');

    if (token) {
        const octokit = new Octokit({ auth: token });
        try {
            const { data: { login, avatar_url } } = await octokit.request('GET /user');

            userAvatar.src = avatar_url;
            userLogin.textContent = login;

            loginBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userInfo.classList.add('flex');

            editButtons.forEach(btn => btn.classList.remove('hidden'));

        } catch (error) {
            console.error("Error fetching user from GitHub", error);
            // Token might be invalid, so log out
            alert('GitHub token a-t-il expiré. Veuillez vérifier votre jeton et réessayer.');
            Cookies.remove(TOKEN_COOKIE);
            updateLoginState();
        }
    } else {
        loginBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');
        editButtons.forEach(btn => btn.classList.add('hidden'));
    }
}

const editModal = document.getElementById('edit-modal');
const editTagsContainer = document.getElementById('edit-tags-container');

const allTags = [
    { key: 'cancelable', label: '可免費取消', type: 'positive' },
    { key: 'isRedLightDistrict', label: '靠近紅燈區', type: 'negative' },
    { key: 'isPoorSoundproofing', label: '隔音差', type: 'negative' },
    { key: 'hasSofaBed', label: '沙發床', type: 'negative' },
    { key: 'hasFewOutlets', label: '插座少', type: 'negative' },
    { key: 'hasWiFi', label: 'WiFi', type: 'amenity' },
    { key: 'hasPool', label: '游泳池', type: 'amenity' },
    { key: 'hasWashingMachine', label: '洗衣機', type: 'amenity' },
];

function openEditModal(hotelName) {
    const hotel = hotels.find(h => h.name === hotelName);
    if (!hotel) return;

    document.getElementById('edit-hotel-name').textContent = hotel.name;
    document.getElementById('edit-original-name').value = hotel.name;
    document.getElementById('edit-price').value = hotel.price;
    document.getElementById('edit-size').value = hotel.size;
    document.getElementById('edit-note').value = hotel.note || '';

    editTagsContainer.innerHTML = '';
    allTags.forEach(tag => {
        const isChecked = hotel[tag.key] === true;
        const checkboxId = `edit-tag-${tag.key}`;
        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.className = 'flex items-center p-2 bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer';
        label.innerHTML = `
            <input type="checkbox" id="${checkboxId}" name="${tag.key}" ${isChecked ? 'checked' : ''}
                   class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500">
            <span class="ml-2 text-xs md:text-sm text-slate-600">${tag.label}</span>
        `;
        editTagsContainer.appendChild(label);
    });

    editModal.classList.remove('hidden');
}


// 初始啟動
renderHotels();
geocodeAllHotels(); // 背景開始獲取座標

updateLoginState();

// --- Event Listeners ---

loginBtn.addEventListener('click', () => {
    patModal.classList.remove('hidden');
});

logoutBtn.addEventListener('click', () => {
    Cookies.remove(TOKEN_COOKIE);
    updateLoginState();
});

document.getElementById('cancel-pat-btn').addEventListener('click', () => {
    patModal.classList.add('hidden');
});

document.getElementById('save-pat-btn').addEventListener('click', () => {
    const pat = document.getElementById('pat-input').value;
    if (pat) {
        Cookies.set(TOKEN_COOKIE, pat, { expires: 30 }); // Save for 30 days
        patModal.classList.add('hidden');
        document.getElementById('pat-input').value = '';
        updateLoginState();
    }
});

grid.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('edit-btn')) {
        const hotelName = e.target.dataset.hotelName;
        openEditModal(hotelName);
    }
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editModal.classList.add('hidden');
});

async function submitChanges(event) {
    event.preventDefault();

    const saveBtn = document.getElementById('save-edit-btn');
    const btnText = document.getElementById('save-btn-text');
    const spinner = document.getElementById('loading-spinner');
    const feedback = document.getElementById('pr-feedback');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    saveBtn.disabled = true;
    feedback.textContent = '';

    const token = Cookies.get(TOKEN_COOKIE);
    if (!token) {
        feedback.textContent = '錯誤：GitHub PAT 遺失。';
        return;
    }

    const octokit = new Octokit({ auth: token });

    const originalName = document.getElementById('edit-original-name').value;
    const updatedHotel = {
        name: originalName, // Name is the key, should not be changed in this UI
        price: parseInt(document.getElementById('edit-price').value),
        size: parseInt(document.getElementById('edit-size').value),
        note: document.getElementById('edit-note').value,
    };

    allTags.forEach(tag => {
        const checkbox = document.getElementById(`edit-tag-${tag.key}`);
        if (checkbox) {
            updatedHotel[tag.key] = checkbox.checked;
        }
    });

    try {
        const owner = 'Xiaowei6636';
        const repo = 'Hotel-Choose';
        const path = 'data.js';

        // 1. Get the latest commit SHA of the main branch and the file's current SHA
        const { data: { object: { sha: latestSha } } } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
            owner,
            repo,
            ref: 'heads/main' // or your default branch
        });

        // 2. Get the current content of data.js
        const { data: { content: currentContentBase64, sha: fileSha } } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path,
            ref: 'main' // Fetch from the base branch
        });

        const currentContent = decodeURIComponent(escape(atob(currentContentBase64)));

        // 尋找陣列的起始與結束位置
        const arrayStart = currentContent.indexOf('[');
        const arrayEnd = currentContent.lastIndexOf('];');

        // 擷取陣列後的內容（例如註解）
        const trailingContent = arrayEnd !== -1 ? currentContent.substring(arrayEnd + 2) : '';

        // 擷取陣列字串
        const hotelsArrayString = currentContent.substring(arrayStart, arrayLastIndex !== -1 ? arrayLastIndex + 1 : undefined);

        // Using a safer method to convert string to array of objects
        const tempHotels = new Function('return ' + hotelsArrayString)();

        const hotelIndex = tempHotels.findIndex(h => h.name === originalName);
        if (hotelIndex === -1) throw new Error("Hotel not found in data.js");

        // Merge existing data with updated data
        tempHotels[hotelIndex] = { ...tempHotels[hotelIndex], ...updatedHotel };

        // Convert back to a nicely formatted string
        const newHotelsArrayString = JSON.stringify(tempHotels, null, 4);
        const newContent = `export const hotels = ${newHotelsArrayString};${trailingContent}`;

        // 3. Create a new branch
        const branchName = `update-${originalName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: latestSha
        });

        // 4. Create a new commit with the updated file
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path,
            message: `Update ${originalName} data`,
            content: btoa(unescape(encodeURIComponent(newContent))),
            sha: (await octokit.request('GET /repos/{owner}/{repo}/contents/{path}?ref={ref}', { owner, repo, path, ref: branchName })).data.sha,
            branch: branchName
        });

        // 5. Create a Pull Request
        const { data: pullRequest } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            title: `Update data for ${originalName}`,
            head: branchName,
            base: 'main', // or your default branch
            body: `This PR was automatically generated to update the data for ${originalName}.`
        });

        feedback.innerHTML = `成功！已建立 <a href="${pullRequest.html_url}" target="_blank" class="text-blue-600 underline">Pull Request #${pullRequest.number}</a>。`;
        setTimeout(() => {
            editModal.classList.add('hidden');
        }, 5000);


    } catch (error) {
        console.error("GitHub API error:", error);
        feedback.textContent = `Error: ${error.message}`;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        saveBtn.disabled = false;
    }
}

document.getElementById('edit-form').addEventListener('submit', submitChanges);
