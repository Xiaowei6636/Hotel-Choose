export const hotels = [
    { name: "V Hotel Bencoolen", price: 6377, cancelable: false, size: 16, note: "" },
    { name: "Hotel Mi Bencoolen", price: 6507, cancelable: true, size: 17, note: "" },
    { name: "Hotel Mi Rochor", price: 6627, cancelable: false, size: 17, note: "" },
    { name: "Furama RiverFront", price: 5360, cancelable: false, size: 30, note: "" },
    { name: "Owen House by Habyt", price: 8271, cancelable: false, size: 32, note: "" },
    { name: "V Hotel Lavender", price: 6883, cancelable: false, size: 16, note: "" },
    { name: "Hotel Classic by Venue", price: 4300, cancelable: true, size: 18, note: "部分無窗" }, // 這裡補上了逗號，拿掉了分號
    { name: "Strand Hotel Singapore", price: 6500, cancelable: true, size: 34, hasSofaBed: false, hasFewOutlets: false, note: "免費無限網路/免費停車場/入住前2天並在14點前方可免費取消" }
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
 * * 範例：
 * { name: "範例飯店", price: 5000, ..., isRedLightDistrict: true }
 * * 若未填寫（保持目前這樣），網頁卡片將統一顯示「未提供資訊」。
 */
