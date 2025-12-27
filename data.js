export const hotels = [
    {
        "name": "V Hotel Bencoolen",
        "price": 6377,
        "cancelable": false,
        "size": 16,
        "note": "房間大多整節乾淨但擁擠/服務好/號稱出站7秒可達/無瓶裝水/部份房間有異味或窗戶正對泳池/健身房",
        "hasWiFi": true,
        "hasPool": true,
        "isRedLightDistrict": false,
        "hasWashingMachine": true,
        "hasFewOutlets": true,
        "isPoorSoundproofing": true,
        "hasSofaBed": false,
        "isSafeLocation": true,
        "isSoundproof": false,
        "hasRealBed": true,
        "hasPlentyOutlets": false
    },
    {
        "name": "Hotel Mi Bencoolen",
        "price": 6507,
        "cancelable": true,
        "size": 17,
        "note": "",
        "hasWiFi": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true
    },
    {
        "name": "Hotel Mi Rochor",
        "price": 6627,
        "cancelable": false,
        "size": 17,
        "note": "",
        "hasWiFi": true,
        "hasPool": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true
    },
    {
        "name": "Furama RiverFront",
        "price": 6702,
        "cancelable": false,
        "size": 30,
        "note": "健身房/酒吧/水療服務/無客房清潔",
        "hasWiFi": true,
        "hasPool": true,
        "hasWashingMachine": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true
    },
    {
        "name": "Owen House by Habyt",
        "price": 8271,
        "cancelable": false,
        "size": 32,
        "note": "機場接駁/酒吧/部分有廚房",
        "hasWiFi": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true
    },
    {
        "name": "V Hotel Lavender",
        "price": 6883,
        "cancelable": false,
        "size": 16,
        "note": "酒吧",
        "hasWiFi": true,
        "hasPool": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true
    },
    {
        "name": "Hotel Classic by Venue",
        "price": 4300,
        "cancelable": true,
        "size": 18,
        "note": "部分無窗",
        "hasWiFi": true,
        "lat": 1.3159092188196442,
        "lon": 103.8977450655825,
        "isRedLightDistrict": true,
        "isPoorSoundproofing": true,
        "isSafeLocation": false,
        "isSoundproof": false
    },
    {
        "name": "Strand Hotel Singapore",
        "price": 6500,
        "cancelable": true,
        "size": 18,
        "hasFewOutlets": true,
        "note": "三人房(18/2sig+1ex)/前2天14點前方可取消",
        "hasWiFi": true,
        "hasWashingMachine": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true,
        "hasPlentyOutlets": false
    },
    {
        "name": "Strand Hotel Singapore",
        "price": 6800,
        "cancelable": true,
        "size": 20,
        "hasFewOutlets": false,
        "note": "三人房(20/2sig+1ex)/前2天14點前方可取消",
        "hasWiFi": true,
        "hasWashingMachine": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true,
        "hasPlentyOutlets": true
    },
    {
        "name": "Strand Hotel Singapore",
        "price": 8850,
        "cancelable": true,
        "size": 34,
        "hasFewOutlets": false,
        "note": "家庭房(2張雙人床)/前2天14點前方可取消",
        "hasWiFi": true,
        "hasWashingMachine": true,
        "isRedLightDistrict": false,
        "isSafeLocation": true,
        "hasPlentyOutlets": true
    },
    {
        "name": "Test",
        "price": null,
        "size": 20,
        "note": ""
    }
];


/**
 * --- 填寫說明 ---
 * 所有屬性皆採「正向邏輯」，即 true 代表正面/良好的情況。
 * * 屬性名稱對照表：
 * - isSafeLocation: true       (環境安全，不靠近紅燈區)
 * - isSoundproof: true         (隔音良好)
 * - hasRealBed: true           (非沙發床，有正式床鋪)
 * - hasPlentyOutlets: true     (插座充足)
 * - hasWiFi: true              (包含WiFi)
 * - hasPool: true              (包含游泳池)
 * - hasWashingMachine: true    (包含洗衣機)
 * - cancelable: true           (可免費取消)
 * - lat: 1.2345, lon: 103.123  (手動指定座標，若未填寫則自動查詢)
 * * 範例：
 * { name: "範例飯店", price: 5000, isSafeLocation: true, ... }
 * * 若未填寫，網頁卡片將統一顯示「未提供資訊」。
 */
