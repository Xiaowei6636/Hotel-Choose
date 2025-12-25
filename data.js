export const hotels = [
    { name: "V Hotel Bencoolen", price: 6377, cancelable: false, size: 16, note: "" },
    { name: "Hotel Mi Bencoolen", price: 6507, cancelable: true, size: 17, note: "" },
    { name: "Hotel Mi Rochor", price: 6627, cancelable: false, size: 17, note: "" },
    { name: "Furama RiverFront", price: 5360, cancelable: false, size: 30, note: "" },
    { name: "Owen House by Habyt", price: 8271, cancelable: false, size: 32, note: "" },
    { name: "V Hotel Lavender", price: 6883, cancelable: false, size: 16, note: "" },
    { name: "Hotel Classic by Venue", price: 4300, cancelable: true, size: 18, note: "部分無窗" },
    { name: "Strand Hotel Singapore", price: 6500, cancelable: true, size: 18, hasFewOutlets: true, note: "三人房(18/2sig+1ex)/WiFI/前2天14點前方可取消" },
    { name: "Strand Hotel Singapore", price: 6800, cancelable: true, size: 20, hasFewOutlets: false, note: "三人房(20/2sig+1ex)/WiFI/前2天14點前方可取消" },
    { name: "Strand Hotel Singapore", price: 8850, cancelable: true, size: 34, hasFewOutlets: false, note: "家庭房(2張雙人床/WiFi/前2天14點前方可取消" }
];


/**
 * --- 填寫說明 ---
 * 若要標註特定資訊，請在該飯店物件中新增對應屬性並設為 true。
 * * 屬性名稱對照表：
 * - isRedLightDistrict: true   (靠近紅燈區)
 * - isPoorSoundproofing: true  (隔音較差)
 * - hasSofaBed: true           (有沙發床)
 * - hasNoBaggageStorage: true  (無行李寄放)
 * - hasFewOutlets: true        (插座少)
 * - hasNoParking: true         (無停車場)
 * * 範例：
 * { name: "範例飯店", price: 5000, ..., isRedLightDistrict: true }
 * * 若未填寫，網頁卡片將統一顯示「未提供資訊」。
 */
