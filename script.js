import { hotels } from './data.js';
import { Octokit } from "https://esm.sh/@octokit/core";

/**
 * --- 應用程式設定 ---
 */
const CONFIG = {
    CACHE_KEY: 'hotel_coords_cache_v1',
    TOKEN_COOKIE: 'github_pat',
    REPO_OWNER: 'Xiaowei6636',
    REPO_NAME: 'Hotel-Choose',
    NOMINATIM_DELAY: 1200,
    ALL_TAGS: [
        { key: 'cancelable', label: '可免費取消', negativeLabel: '不可取消', type: 'positive', filterId: 'cancelableOnly' },
        { key: 'isSafeLocation', label: '非靠近紅燈區', negativeLabel: '靠近紅燈區', type: 'positive', filterId: 'safeAreaFilter' },
        { key: 'isSoundproof', label: '非隔音差', negativeLabel: '隔音差', type: 'positive', filterId: 'goodSoundFilter' },
        { key: 'hasRealBed', label: '非沙發床', negativeLabel: '沙發床', type: 'positive', filterId: 'realBedFilter' },
        { key: 'hasPlentyOutlets', label: '非插座少', negativeLabel: '插座少', type: 'positive', filterId: 'plentyOutletsFilter' },
        { key: 'hasWiFi', label: 'WiFi', type: 'amenity', filterId: 'wifiFilter' },
        { key: 'hasPool', label: '游泳池', type: 'amenity', filterId: 'poolFilter' },
        { key: 'hasWashingMachine', label: '洗衣機', type: 'amenity', filterId: 'washerFilter' },
    ]
};

/**
 * --- 資料處理服務 ---
 */
const DataService = {
    async loadMRTStations() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/datagovsg/fare-based-mrt-station-data/main/data/mrt_station_data.json');
            const data = await response.json();
            const stations = Object.entries(data).map(([code, details]) => {
                const name = details['MRT Station'];
                const [lat, lon] = details.coordinates.split(',').map(Number);
                const lineCode = code.substring(0, 2);
                let color = '#748477';
                if (['NS', 'NE', 'CG', 'CE', 'CC', 'DT', 'TE'].includes(lineCode)) {
                    if (lineCode === 'NS') color = '#d42e12';
                    else if (lineCode === 'NE') color = '#800080';
                    else if (['CG', 'CE'].includes(lineCode)) color = '#009645';
                    else if (lineCode === 'CC') color = '#ff9a00';
                    else if (lineCode === 'DT') color = '#005ec4';
                    else if (lineCode === 'TE') color = '#733104';
                }
                return { name, coordinates: [lat, lon], color };
            });
            State.mrtStations = stations;
            State.mrtGeoJSON = {
                type: "FeatureCollection",
                features: stations.map(s => ({
                    type: "Feature",
                    properties: { name: s.name, color: s.color },
                    geometry: { type: "Point", coordinates: [s.coordinates[1], s.coordinates[0]] }
                }))
            };
        } catch (error) {
            console.error('無法載入捷運站點資料:', error);
        }
    },

    enrichHotelData() {
        if (State.mrtStations.length === 0) {
            console.warn("MRT station data not available for hotel data enrichment.");
            return;
        }

        hotels.forEach(hotel => {
            const coords = (hotel.lat && hotel.lon) ? { lat: hotel.lat, lon: hotel.lon } : State.coordsCache[hotel.name];
            if (!coords) return;

            let closestStation = null;
            let minDistance = Infinity;

            State.mrtStations.forEach(station => {
                const distance = Utils.calculateDistance(coords.lat, coords.lon, station.coordinates[0], station.coordinates[1]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestStation = station;
                }
            });

            if (closestStation) {
                hotel.nearestStationName = closestStation.name;
                hotel.nearestStationDistance = minDistance;
                hotel.nearestStationColor = closestStation.color;
            }
        });
    }
};

/**
 * --- 全域狀態 ---
 */
const State = {
    coordsCache: JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}'),
    currentFilteredHotels: [],
    map: null,
    isMapView: false,
    markerLayer: L.layerGroup(),
    pendingEditIndex: null,
    dataSha: null,
    mrtStations: [],
    mrtGeoJSON: null,
    currentMrtMarker: null,
};

/**
 * --- 工具函式 ---
 */
const Utils = {
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    saveCache: () => localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(State.coordsCache)),
    clearCache: () => {
        localStorage.removeItem(CONFIG.CACHE_KEY);
        State.coordsCache = {};
        location.reload();
    },
    // Haversine formula to calculate distance between two lat/lon points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }
};

/**
 * --- 地理編碼與地圖服務 ---
 */
const MapService = {
    async getCoordinates(name) {
        if (State.coordsCache[name]) return State.coordsCache[name];

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ' Singapore')}&format=json&limit=1`);
            const data = await response.json();
            if (data && data.length > 0) {
                const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
                State.coordsCache[name] = result;
                Utils.saveCache();
                return result;
            }
        } catch (e) {
            console.error(`地理編碼失敗 (${name}):`, e);
        }
        return null;
    },

    async geocodeAll() {
        const geocodingPromises = hotels.map(async (h) => {
            if (h.lat && h.lon) {
                State.coordsCache[h.name] = { lat: h.lat, lon: h.lon };
                return; // Already has coordinates
            }
            if (!State.coordsCache[h.name]) {
                await Utils.delay(CONFIG.NOMINATIM_DELAY); // Wait before the request
                const coords = await this.getCoordinates(h.name);
                if (coords) {
                    State.coordsCache[h.name] = coords;
                }
            }
        });
        await Promise.all(geocodingPromises);
        Utils.saveCache(); // Save cache once at the end
    },

    init() {
        if (State.map) {
            State.map.invalidateSize();
            return;
        }

        State.map = L.map('map').setView([1.3521, 103.8198], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(State.map);

        // 紅燈區範圍 (芽籠)
        const redLightDistrictPoints = [
            [1.3115, 103.8728], [1.3150, 103.8915], [1.3175, 103.8910], [1.3140, 103.8720]
        ];
        L.polygon(redLightDistrictPoints, {
            color: '#ff0000', fillColor: '#ff0000', fillOpacity: 0.3, weight: 1, stroke: true, dashArray: '5, 5'
        }).addTo(State.map).bindTooltip("芽籠紅燈區 (Geylang Red Light District)", { sticky: true });

        // 捷運路線
        this.loadMRTLines();
    },

    loadMRTLines() {
        fetch('https://raw.githubusercontent.com/cheeaun/sgraildata/master/data/v1/sg-rail.geojson')
            .then(res => res.json())
            .then(data => {
                L.geoJSON(data, {
                    filter: f => f.geometry.type.includes('LineString'),
                    style: f => {
                        const name = (f.properties.name || '').toLowerCase();
                        const colors = (f.properties.station_colors || '').toLowerCase();
                        let color = '#748477';
                        if (colors.includes('red') || name.includes('north south')) color = '#d42e12';
                        else if (colors.includes('green') || name.includes('east west')) color = '#009645';
                        else if (colors.includes('purple') || name.includes('north east')) color = '#800080';
                        else if (colors.includes('yellow') || colors.includes('orange') || name.includes('circle')) color = '#ff9a00';
                        else if (colors.includes('blue') || name.includes('downtown')) color = '#005ec4';
                        else if (colors.includes('brown') || name.includes('thomson')) color = '#733104';
                        return { color, weight: 2, opacity: 0.5 };
                    }
                }).addTo(State.map);
            });
    },

    highlightMRTStation(hotel) {
        if (State.currentMrtMarker) {
            State.map.removeLayer(State.currentMrtMarker);
        }
        if (!hotel.nearestStationName || !State.mrtGeoJSON) return;

        const stationFeature = State.mrtGeoJSON.features.find(
            f => f.properties.name === hotel.nearestStationName
        );

        if (stationFeature) {
            const [lon, lat] = stationFeature.geometry.coordinates;
            State.currentMrtMarker = L.circleMarker([lat, lon], {
                radius: 8,
                fillColor: stationFeature.properties.color,
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).bindTooltip(hotel.nearestStationName, { permanent: true, direction: 'top', offset: [0, -10] }).addTo(State.map);
        }
    },


    updateMarkers() {
        if (!State.map) return;
        State.markerLayer.clearLayers();

        const groups = {};
        State.currentFilteredHotels.forEach(h => {
            const coords = (h.lat && h.lon) ? { lat: h.lat, lon: h.lon } : State.coordsCache[h.name];
            if (coords) {
                const key = `${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`;
                if (!groups[key]) groups[key] = { coords, hotels: [] };
                groups[key].hotels.push(h);
            }
        });

        Object.values(groups).forEach(group => {
            const marker = L.marker([group.coords.lat, group.coords.lon]);
            let content = `<div class="p-1 min-w-[200px] max-w-[280px] max-h-[400px] overflow-y-auto">`;

            marker.on('click', () => {
                // 當點擊飯店標記時，只高亮距離最近的一間飯店的捷運站
                if (group.hotels.length > 0) {
                    MapService.highlightMRTStation(group.hotels[0]);
                }
            });

            marker.on('popupclose', () => {
                if (State.currentMrtMarker) {
                    State.map.removeLayer(State.currentMrtMarker);
                    State.currentMrtMarker = null;
                }
            });


            if (group.hotels.length > 1) {
                content += `<div class="sticky top-0 bg-white border-b mb-2 pb-2 z-10 font-bold text-sm text-blue-600">此處有 ${group.hotels.length} 間飯店</div>`;
            }

            group.hotels.forEach((h, i) => {
                const isMultiple = group.hotels.length > 1;
                content += `
                    <div class="${i > 0 ? 'mt-3 pt-3 border-t' : ''}">
                        <div class="flex justify-between items-start gap-2">
                            <h4 class="${isMultiple ? 'text-sm' : 'text-lg'} font-bold">${h.name}</h4>
                            <span class="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded font-bold">$${h.price.toLocaleString()}</span>
                        </div>
                        <div class="text-sm text-slate-600 mt-1">${h.size} m²</div>
                        ${h.note ? `<div class="text-xs italic bg-slate-50 p-1.5 rounded mt-1 border">${h.note}</div>` : ''}
                        <a href="https://www.google.com/maps/search/${encodeURIComponent(h.name + ' Singapore')}" target="_blank" class="block w-full text-center bg-blue-600 !text-white text-[10px] py-1.5 rounded mt-2 font-bold">查看地圖</a>
                    </div>
                `;
            });
            content += `</div>`;
            marker.bindPopup(content).addTo(State.markerLayer);
        });

        if (!State.map.hasLayer(State.markerLayer)) State.markerLayer.addTo(State.map);
    }
};

/**
 * --- GitHub 服務 ---
 */
const GitHubService = {
    getOctokit() {
        const token = Cookies.get(CONFIG.TOKEN_COOKIE);
        return token ? new Octokit({ auth: token }) : null;
    },

    async getUserInfo() {
        const octokit = this.getOctokit();
        if (!octokit) return null;
        try {
            const { data } = await octokit.request('GET /user');
            return data;
        } catch (e) {
            if (e.status === 401) Cookies.remove(CONFIG.TOKEN_COOKIE);
            return null;
        }
    },

    async createPR(updatedHotel, hotelIndexInOriginal, originalName, action = 'update') {
        const octokit = this.getOctokit();
        if (!octokit) throw new Error("未登入 GitHub");

        const owner = CONFIG.REPO_OWNER;
        const repo = CONFIG.REPO_NAME;
        const path = 'data.js';

        // 1. 取得主分支最新 SHA 與 data.js 內容
        const { data: { object: { sha: latestSha } } } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: 'heads/main' });
        const { data: { content: b64, sha: fileSha } } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref: 'main' });

        const currentContent = decodeURIComponent(escape(atob(b64)));
        const arrayStart = currentContent.indexOf('[');
        const arrayEnd = currentContent.lastIndexOf('];');
        const trailingContent = arrayEnd !== -1 ? currentContent.substring(arrayEnd + 2) : '';
        const hotelsArrayString = currentContent.substring(arrayStart, arrayEnd !== -1 ? arrayEnd + 1 : undefined);

        const tempHotels = new Function('return ' + hotelsArrayString)();

        // 2. 執行操作
        let commitMessage = '';
        let prTitle = '';
        let prBody = '';

        if (action === 'add') {
            tempHotels.push(updatedHotel);
            commitMessage = `Add new hotel: ${updatedHotel.name}`;
            prTitle = `Add new hotel: ${updatedHotel.name}`;
            prBody = `此 PR 由飯店挑選助手自動產生，新增飯店 ${updatedHotel.name} 的資料。`;
        } else {
            // 尋找飯店 (update 或 delete)
            let idx = hotelIndexInOriginal;
            if (idx === -1 || !tempHotels[idx] || tempHotels[idx].name !== originalName) {
                idx = tempHotels.findIndex(h => h.name === originalName);
            }
            if (idx === -1) throw new Error("找不到該飯店資料");

            if (action === 'delete') {
                tempHotels.splice(idx, 1);
                commitMessage = `Delete hotel: ${originalName}`;
                prTitle = `Delete hotel: ${originalName}`;
                prBody = `此 PR 由飯店挑選助手自動產生，刪除飯店 ${originalName} 的資料。`;
            } else {
                tempHotels[idx] = { ...tempHotels[idx], ...updatedHotel };
                commitMessage = `Update ${originalName} data`;
                prTitle = `Update data for ${originalName}`;
                prBody = `此 PR 由飯店挑選助手自動產生，更新 ${originalName} 的資料。`;
            }
        }

        const newContent = `export const hotels = ${JSON.stringify(tempHotels, null, 4)};${trailingContent}`;

        // 3. 建立分支與提交
        const branchName = `${action}-${(updatedHotel?.name || originalName).toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        await octokit.request('POST /repos/{owner}/{repo}/git/refs', { owner, repo, ref: `refs/heads/${branchName}`, sha: latestSha });

        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner, repo, path,
            message: commitMessage,
            content: btoa(unescape(encodeURIComponent(newContent))),
            branch: branchName,
            sha: (await octokit.request('GET /repos/{owner}/{repo}/contents/{path}?ref={ref}', { owner, repo, path, ref: branchName })).data.sha
        });

        // 4. 建立 PR
        return await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            owner, repo, title: prTitle,
            head: branchName, base: 'main',
            body: prBody
        });
    },

    async checkForUpdates() {
        const owner = CONFIG.REPO_OWNER;
        const repo = CONFIG.REPO_NAME;
        const path = 'data.js';

        try {
            const octokit = this.getOctokit() || new Octokit();
            const { data: { sha: latestSha } } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner, repo, path, ref: 'main'
            });

            if (!State.dataSha) {
                State.dataSha = latestSha;
                console.log(`已記錄 data.js 初始版本: ${latestSha.substring(0, 7)}`);
            } else if (State.dataSha !== latestSha) {
                console.log(`偵測到 data.js 更新！從 ${State.dataSha.substring(0, 7)} -> ${latestSha.substring(0, 7)}`);
                UI.showUpdateToast();
                State.dataSha = latestSha; // 更新 SHA 以免重複提示
            }
        } catch (error) {
            console.error('檢查更新時發生錯誤:', error);
        }
    }
};

/**
 * --- UI 與 渲染邏輯 ---
 */
const UI = {
    elements: {
        grid: document.getElementById('hotelGrid'),
        noResults: document.getElementById('noResults'),
        priceRange: document.getElementById('priceRange'),
        priceDisplay: document.getElementById('priceDisplay'),
        sizeFilter: document.getElementById('sizeFilter'),
        mrtDistanceRange: document.getElementById('mrtDistanceRange'),
        mrtDistanceDisplay: document.getElementById('mrtDistanceDisplay'),
        cancelableOnly: document.getElementById('cancelableOnly'),
        viewToggleBtn: document.getElementById('viewToggleBtn'),
        mainContent: document.getElementById('mainContent'),
        mapContainer: document.getElementById('mapContainer'),
        toggleText: document.getElementById('toggleText'),
        toggleIcon: document.getElementById('toggleIcon'),
        debugPanel: document.getElementById('debugPanel'),
        debugList: document.getElementById('debugList'),
        loginBtn: document.getElementById('login-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        userInfo: document.getElementById('user-info'),
        userAvatar: document.getElementById('user-avatar'),
        userLogin: document.getElementById('user-login'),
        addHotelBtn: document.getElementById('add-hotel-btn'),
        deleteHotelBtn: document.getElementById('delete-hotel-btn'),
        patModal: document.getElementById('pat-modal'),
        editModal: document.getElementById('edit-modal'),
        editTagsContainer: document.getElementById('edit-tags-container'),
        toast: document.getElementById('toast'),
        toastContent: document.getElementById('toast-content')
    },

    init() {
        this.bindEvents();
        this.updateLoginState();
        this.updatePriceDisplay();
        this.updateMRTDistantDisplay();
        // filterHotels() will be called by the main initialize function
    },

    updatePriceDisplay() {
        const el = this.elements.priceRange;
        const display = this.elements.priceDisplay;
        const max = parseInt(el.max);
        const current = parseInt(el.value);

        if (current === max) {
            display.textContent = '無限制';
        } else {
            display.textContent = `$${current.toLocaleString()}`;
        }
    },

    updateMRTDistantDisplay() {
        const el = this.elements.mrtDistanceRange;
        const display = this.elements.mrtDistanceDisplay;
        const max = parseFloat(el.max);
        const current = parseFloat(el.value);

        if (current >= max) {
            display.textContent = '無限制';
        } else {
            display.textContent = `< ${current.toFixed(1)} km`;
        }
    },


    bindEvents() {
        // 篩選器監聽
        const filters = ['priceRange', 'sizeFilter', 'mrtDistanceRange', 'cancelableOnly', 'safeAreaFilter', 'goodSoundFilter', 'realBedFilter', 'plentyOutletsFilter', 'wifiFilter', 'poolFilter', 'washerFilter'];
        filters.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(id.includes('Range') ? 'input' : 'change', () => {
                    if (id === 'priceRange') this.updatePriceDisplay();
                    if (id === 'mrtDistanceRange') this.updateMRTDistantDisplay();
                    this.filterHotels();
                });
            }
        });

        // 檢視切換
        this.elements.viewToggleBtn.addEventListener('click', () => this.toggleMapView());

        // Debug Panel (三連擊標題)
        const pageTitle = document.querySelector('header h1');
        let clickCount = 0;
        pageTitle?.addEventListener('click', () => {
            clickCount++;
            setTimeout(() => clickCount = 0, 500);
            if (clickCount === 3) {
                this.elements.debugPanel.classList.remove('hidden');
                this.renderDebugList();
            }
        });

        // GitHub 互動
        this.elements.loginBtn.addEventListener('click', () => this.elements.patModal.classList.remove('hidden'));
        this.elements.logoutBtn.addEventListener('click', () => {
            Cookies.remove(CONFIG.TOKEN_COOKIE);
            this.updateLoginState();
        });
        document.getElementById('save-pat-btn').addEventListener('click', () => {
            const pat = document.getElementById('pat-input').value;
            if (pat) {
                Cookies.set(CONFIG.TOKEN_COOKIE, pat, { expires: 30 });
                this.elements.patModal.classList.add('hidden');
                this.updateLoginState().then(() => {
                    if (State.pendingEditIndex !== null) {
                        this.openEditModal(State.pendingEditIndex);
                        State.pendingEditIndex = null;
                    }
                });
            }
        });
        document.getElementById('cancel-pat-btn').addEventListener('click', () => this.elements.patModal.classList.add('hidden'));
        document.getElementById('cancel-edit-btn').addEventListener('click', () => this.elements.editModal.classList.add('hidden'));
        this.elements.addHotelBtn.addEventListener('click', () => this.openEditModal(-1));
        this.elements.deleteHotelBtn.addEventListener('click', () => this.handleDelete());

        this.elements.grid.addEventListener('click', (e) => {
            const card = e.target.closest('.hotel-card');
            if (card && card.dataset.index !== undefined) {
                const index = parseInt(card.dataset.index);
                if (Cookies.get(CONFIG.TOKEN_COOKIE)) {
                    this.openEditModal(index);
                } else {
                    State.pendingEditIndex = index;
                    this.elements.patModal.classList.remove('hidden');
                }
            }
        });
        document.getElementById('edit-form').addEventListener('submit', (e) => this.handleEditSubmit(e));
        document.getElementById('closeDebugBtn').addEventListener('click', () => this.elements.debugPanel.classList.add('hidden'));
        document.getElementById('clearCacheBtn').addEventListener('click', () => Utils.clearCache());
    },

    async updateLoginState() {
        try {
            const user = await GitHubService.getUserInfo();
            if (user) {
                console.log('GitHub 登入成功:', user.login);
                this.elements.userAvatar.src = user.avatar_url;
                this.elements.userLogin.textContent = user.login;
                this.elements.loginBtn.classList.add('hidden');

                // 確保顯示使用者資訊區塊
                this.elements.userInfo.classList.remove('hidden');
                this.elements.userInfo.classList.add('flex');
            } else {
                console.log('未登入或 GitHub Token 無效');
                this.elements.loginBtn.classList.add('hidden'); // 依要求平常隱藏
                this.elements.userInfo.classList.add('hidden');
                this.elements.userInfo.classList.remove('flex');
            }
        } catch (err) {
            console.error('更新登入狀態時發生錯誤:', err);
            this.elements.loginBtn.classList.add('hidden');
            this.elements.userInfo.classList.add('hidden');
        }
        this.filterHotels(); // 重繪以反映編輯權限
    },

    toggleMapView() {
        State.isMapView = !State.isMapView;
        this.elements.mainContent.classList.toggle('hidden', State.isMapView);
        this.elements.mapContainer.classList.toggle('hidden', !State.isMapView);
        this.elements.toggleText.textContent = State.isMapView ? '返回列表' : '查看地圖';
        this.elements.toggleIcon.innerHTML = State.isMapView ?
            `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>` :
            `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-1.447-.894L15 7m0 10V7" /></svg>`;

        if (State.isMapView) {
            setTimeout(() => {
                MapService.init();
                MapService.updateMarkers();
            }, 100);
        }
    },

    filterHotels() {
        const maxPrice = parseInt(this.elements.priceRange.value);
        const isPriceUnlimited = maxPrice === parseInt(this.elements.priceRange.max);
        const minSize = parseInt(this.elements.sizeFilter.value);
        const maxMrtDistance = parseFloat(this.elements.mrtDistanceRange.value);
        const isMrtDistanceUnlimited = maxMrtDistance >= parseFloat(this.elements.mrtDistanceRange.max);


        State.currentFilteredHotels = hotels.filter(h => {
            // 基本預算與空間過濾
            if (!isPriceUnlimited && h.price > maxPrice) return false;
            if (minSize > 0 && h.size < minSize) return false;
            if (!isMrtDistanceUnlimited && (h.nearestStationDistance === undefined || h.nearestStationDistance > maxMrtDistance)) return false;


            // 動態標籤過濾：所有屬性現在均為 True = 正面/良好
            for (const tag of CONFIG.ALL_TAGS) {
                const el = document.getElementById(tag.filterId);
                // 如果使用者勾選了該過濾條件，則飯店該屬性必須為 true
                if (el && el.checked && h[tag.key] !== true) return false;
            }

            return true;
        });

        this.renderList();
        MapService.updateMarkers();
    },

    renderList() {
        this.elements.grid.innerHTML = '';
        this.elements.noResults.classList.toggle('hidden', State.currentFilteredHotels.length > 0);

        const hasToken = !!Cookies.get(CONFIG.TOKEN_COOKIE);

        State.currentFilteredHotels.forEach(h => {
            const card = document.createElement('div');
            card.className = `hotel-card bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col cursor-pointer hover:border-blue-200 transition-all`;
            card.dataset.index = hotels.indexOf(h);

            let mrtInfoHTML = '';
            if (h.nearestStationName && h.nearestStationDistance !== undefined) {
                const distanceInMeters = (h.nearestStationDistance * 1000).toFixed(0);
                mrtInfoHTML = `
                    <div class="flex items-center text-sm font-bold mt-2" style="color: ${h.nearestStationColor || '#334155'};">
                        <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span>${h.nearestStationName}站 (約 ${distanceInMeters}m)</span>
                    </div>
                `;
            }

            // 準備標籤並進行排序 (true > false > undefined)
            const tagHTML = CONFIG.ALL_TAGS
                .map(tag => ({ tag, val: h[tag.key] }))
                .sort((a, b) => {
                    const getPriority = (item) => {
                        const { tag, val } = item;
                        // 1. 負面標籤優先 (如：靠近紅燈區)
                        if (val === false && tag.negativeLabel) return 1;
                        // 2. 正面標籤次之 (如：環境安全、有 WiFi)
                        if (val === true) return 2;
                        // 3. 無資訊或一般否定 (如：未提供資訊、WiFi: 無)
                        return 3;
                    };
                    return getPriority(a) - getPriority(b);
                })
                .map(({ tag, val }) => {
                    let color = 'text-slate-400';
                    let text = `${tag.label}: 未提供資訊`;
                    let icon = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'; // Info icon

                    if (val === true) {
                        // 正面/良好狀態：顯示正常標籤
                        color = 'text-slate-800';
                        text = tag.label;
                        icon = 'M5 13l4 4L19 7'; // Check icon
                    } else if (val === false) {
                        // 負面/警告狀態
                        if (tag.negativeLabel) {
                            // 若有定義負面標籤（如：靠近紅燈區），則以警告顏色顯示
                            color = 'text-amber-600 font-bold';
                            text = tag.negativeLabel;
                            icon = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'; // Warning
                        } else {
                            // 一般設施則顯示「無」
                            color = 'text-slate-400';
                            text = `${tag.label}: 無`;
                            icon = 'M6 18L18 6M6 6l12 12'; // X icon
                        }
                    }

                    return `<div class="flex items-start text-sm ${color}"><svg class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"></path></svg><span>${text}</span></div>`;
                }).join('');

            card.innerHTML = `
                <div class="p-5 flex-grow">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-slate-800">${h.name}</h3>
                        <span class="bg-blue-50 text-blue-700 text-sm px-2 py-1 rounded font-medium">$${h.price.toLocaleString()}</span>
                    </div>
                    <div class="space-y-2 mt-4">
                        <div class="flex items-center text-sm text-slate-800 font-medium"><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>${h.size > 0 ? h.size + ' 平方公尺' : '未提供空間資訊'}</div>
                        ${mrtInfoHTML}
                        <hr class="border-slate-100 my-2">
                        <div class="space-y-2">${tagHTML}</div>
                    </div>
                </div>
                <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-start gap-3">
                    <div class="text-xs text-slate-500 italic leading-relaxed">${h.note || ''}</div>
                    <a href="https://www.google.com/maps/search/${encodeURIComponent(h.name + ' Singapore')}" target="_blank" class="text-blue-600 font-semibold text-sm hover:underline flex items-center whitespace-nowrap flex-shrink-0 pt-0.5" onclick="event.stopPropagation()">查看地圖<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>
                </div>
            `;
            this.elements.grid.appendChild(card);
        });
    },

    openEditModal(idx) {
        const isAdd = idx === -1;
        const h = isAdd ? { name: '', price: 5000, size: 20 } : hotels[idx];
        if (!h) return;

        const titleEl = document.getElementById('edit-modal-title');
        if (isAdd) {
            titleEl.innerHTML = '新增飯店';
        } else {
            titleEl.innerHTML = `編輯 <span class="text-blue-600">${h.name}</span>`;
        }

        document.getElementById('edit-original-name').value = h.name;
        document.getElementById('edit-hotel-index').value = idx;
        document.getElementById('edit-name').value = h.name;
        document.getElementById('edit-price').value = h.price;
        document.getElementById('edit-size').value = h.size;
        document.getElementById('edit-note').value = h.note || '';

        // Populate coordinate field
        if (h.lat && h.lon) {
            document.getElementById('edit-coords').value = `${h.lat}, ${h.lon}`;
        } else {
            document.getElementById('edit-coords').value = '';
        }

        // 顯示/隱藏刪除按鈕
        this.elements.deleteHotelBtn.classList.toggle('hidden', isAdd);

        // 更新按鈕文字
        document.getElementById('save-btn-text').textContent = isAdd ? '新增並建立 PR' : '儲存並建立 PR';

        this.elements.editTagsContainer.innerHTML = '';
        CONFIG.ALL_TAGS.forEach(tag => {
            const val = h[tag.key];
            const div = document.createElement('div');
            div.className = 'flex flex-col gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100';
            div.innerHTML = `
                <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">${tag.label}</label>
                <select id="edit-tag-${tag.key}" name="${tag.key}" class="bg-white/50 border-slate-200 rounded-lg text-sm p-1.5 outline-none focus:bg-white transition-colors">
                    <option value="undefined" ${val === undefined ? 'selected' : ''}>❓ 未提供</option>
                    <option value="true" ${val === true ? 'selected' : ''}>✅ 是 / 有</option>
                    <option value="false" ${val === false ? 'selected' : ''}>❌ 否 / 無</option>
                </select>
            `;
            this.elements.editTagsContainer.appendChild(div);
        });

        this.elements.editModal.classList.remove('hidden');
    },

    async handleEditSubmit(e) {
        e.preventDefault();
        const hotelIndex = parseInt(document.getElementById('edit-hotel-index').value);
        const action = hotelIndex === -1 ? 'add' : 'update';

        await this.submitPR(action);
    },

    async handleDelete() {
        if (!confirm('確定要刪除這間飯店嗎？這將會建立一個刪除請求。')) return;
        await this.submitPR('delete');
    },

    async submitPR(action) {
        const saveBtn = document.getElementById('save-edit-btn');
        const deleteBtn = document.getElementById('delete-hotel-btn');
        const feedback = document.getElementById('pr-feedback');
        const btnText = document.getElementById('save-btn-text');
        const spinner = document.getElementById('loading-spinner');

        saveBtn.disabled = true;
        deleteBtn.disabled = true;
        const originalBtnText = btnText.textContent;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        feedback.textContent = '';

        const originalName = document.getElementById('edit-original-name').value;
        const hotelIndex = parseInt(document.getElementById('edit-hotel-index').value);

        const data = {
            name: document.getElementById('edit-name').value,
            price: parseInt(document.getElementById('edit-price').value),
            size: parseInt(document.getElementById('edit-size').value),
            note: document.getElementById('edit-note').value,
        };

        CONFIG.ALL_TAGS.forEach(tag => {
            const val = document.getElementById(`edit-tag-${tag.key}`).value;
            data[tag.key] = val === 'true' ? true : (val === 'false' ? false : undefined);
        });

        const coordsValue = document.getElementById('edit-coords').value.trim();
        if (coordsValue) {
            const parts = coordsValue.split(',').map(s => s.trim());
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lon = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lon)) {
                    data.lat = lat;
                    data.lon = lon;
                }
            }
        } else {
            delete data.lat;
            delete data.lon;
        }

        try {
            const res = await GitHubService.createPR(data, hotelIndex, originalName, action);

            // PR 成功後，直接在本地更新資料並重繪 UI
            if (action === 'delete') {
                hotels.splice(hotelIndex, 1);
            } else if (action === 'update') {
                hotels[hotelIndex] = { ...hotels[hotelIndex], ...data };
            } else if (action === 'add') {
                hotels.push(data);
            }
            this.filterHotels(); // 重繪畫面

            // 立即關閉 Modal
            this.elements.editModal.classList.add('hidden');

            // 彈出酷酷的 Toast
            this.showToast(`
                <div class="text-emerald-600 font-bold flex items-center gap-2 mb-1">
                    <div class="bg-emerald-100 p-1 rounded-full">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    提交成功！已建立 PR #${res.data.number}
                </div>
                <div class="text-slate-600 text-xs leading-relaxed">您的建議已送出，變更將在管理員審核並合併後顯示。<br><a href="${res.data.html_url}" target="_blank" class="text-blue-600 font-bold underline mt-1 inline-block">點此查看 PR 進度</a></div>
            `);

        } catch (err) {
            console.error(err);
            this.showToast(`
                <div class="text-rose-600 font-bold flex items-center gap-2 mb-1">
                    <div class="bg-rose-100 p-1 rounded-full">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </div>
                    發生錯誤
                </div>
                <div class="text-slate-600 text-xs">${err.message}</div>
            `);
        } finally {
            saveBtn.disabled = false;
            deleteBtn.disabled = false;
            btnText.textContent = originalBtnText;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    },

    showToast(html, duration = 7000) {
        this.elements.toastContent.innerHTML = html;
        this.elements.toast.classList.add('show');

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, duration);
    },

    showUpdateToast() {
        const toastHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sky-600 font-bold flex items-center gap-2 mb-1">
                        <div class="bg-sky-100 p-1 rounded-full">
                           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 20v-5h-5"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 9a9 9 0 0 1 9-5.917V0"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 15a9 9 0 0 1-9 5.917V24"></path></svg>
                        </div>
                        偵測到資料更新
                    </div>
                    <div class="text-slate-600 text-xs leading-relaxed">飯店列表已變更，點擊按鈕以重新載入。</div>
                </div>
                <button onclick="location.reload()" class="ml-4 flex-shrink-0 bg-sky-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors">立即重整</button>
            </div>
        `;
        this.showToast(toastHTML, 180000); // 顯示 3 分鐘
    },

    renderDebugList() {
        this.elements.debugList.innerHTML = '';
        hotels.forEach(h => {
            const isManual = h.lat && h.lon;
            const coords = isManual ? { lat: h.lat, lon: h.lon } : State.coordsCache[h.name];
            const item = document.createElement('div');
            item.className = `p-4 rounded-xl border flex items-center justify-between ${coords ? (isManual ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100') : 'bg-rose-50 border-rose-100'}`;
            item.innerHTML = `
                <div>
                    <div class="font-bold text-slate-800">${h.name}${isManual ? ' <span class="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2">手動</span>' : ''}</div>
                    <div class="text-xs ${coords ? (isManual ? 'text-blue-600' : 'text-emerald-600') : 'text-rose-600'} mt-1">${coords ? `座標: ${coords.lat}, ${coords.lon}` : '⚠️ 查無座標'}</div>
                </div>
                ${!coords ? `<a href="https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(h.name + ' Singapore')}&format=json" target="_blank" class="text-xs bg-rose-200 text-rose-800 px-3 py-1.5 rounded-lg font-bold">手動測試</a>` : ''}
            `;
            this.elements.debugList.appendChild(item);
        });
    }
};

/**
 * --- 初始化 ---
 */
async function initialize() {
    UI.init(); // 先初始化 UI，顯示基本介面
    await DataService.loadMRTStations(); // 等待捷運資料載入
    await MapService.geocodeAll(); // 等待所有座標查詢完成
    DataService.enrichHotelData(); // 進行資料關聯
    UI.filterHotels(); // 最後根據完整資料重繪列表

    // 啟動更新檢查
    GitHubService.checkForUpdates();
    setInterval(() => GitHubService.checkForUpdates(), 60000);
}

initialize();
