# Phiếu Lương — Email Open Tracker

Endpoint trên Vercel để tracking email đã mở. Gồm 2 API:

- `GET /api/t/{token}.gif` — Trả 1×1 GIF trong suốt, log vào Upstash Redis
- `GET /api/opens?tokens=a,b,c` (hoặc POST `{tokens: [...]}`) — App gọi để kiểm tra token nào đã mở

Server **KHÔNG** biết email/tên nhân viên là ai — chỉ thấy token UUID random. Mapping token → nhân viên nằm local trong app Phiếu Lương.

## Deploy lên Vercel

### 1. Tạo Upstash Redis (miễn phí)

- Vào [Vercel Marketplace](https://vercel.com/marketplace/upstash) → bấm **Install Upstash**
- Chọn team → chọn project (hoặc tạo mới) → OK
- Vercel tự inject 2 env vars: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

Nếu làm tay (không qua marketplace):
- Tạo account [upstash.com](https://upstash.com), tạo Redis database (Free tier)
- Copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Vào Vercel project → Settings → Environment Variables → paste 2 biến

### 2. Deploy

```bash
cd phieu-luong-tracker
npm install
vercel --prod
```

Hoặc dùng dashboard: link Git repo, Vercel tự build.

Sau deploy, bạn sẽ có URL dạng `https://phieu-luong-tracker-xxxx.vercel.app`.

### 3. Test

```bash
# Pixel (nên trả GIF + log)
curl -v https://your-deploy-url.vercel.app/api/t/550e8400-e29b-41d4-a716-446655440000.gif

# Query status
curl "https://your-deploy-url.vercel.app/api/opens?tokens=550e8400-e29b-41d4-a716-446655440000"
```

### 4. Cấu hình trong app

- Mở Phiếu Lương app → Cài đặt → mục **"Tracking mở email (tuỳ chọn)"**
- Paste URL tracker
- Bật toggle "Chèn pixel tracking vào email"

## Cách hoạt động

1. Khi gửi phiếu lương, app gen UUID v4 cho mỗi nhân viên (`trackToken`)
2. Email body HTML chứa `<img src="https://tracker.vercel.app/api/t/{token}.gif" width="1" height="1" />`
3. Khi nhân viên mở email, mail client tải ảnh → endpoint log vào Redis
4. App gọi `/api/opens?tokens=...` khi xem History để biết ai đã mở

## Hạn chế của tracking pixel

- **Gmail proxy ảnh**: Gmail tải ảnh qua `googleusercontent.com`, nên IP/location trông giống Google, không phải của nhân viên. Mình chỉ biết "đã mở", không biết thiết bị.
- **Nếu email client chặn ảnh** (Outlook default, Apple Mail privacy protection): không log được → trạng thái "Chưa mở" không chắc chắn = chưa đọc thật.
- **Apple Mail Privacy Protection (iOS 15+, macOS 12+)**: Apple pre-fetch ảnh ngay khi email đến → có thể report "đã mở" sai (false positive).
- **Lần mở đầu**: Gmail cache ảnh, nên count thường là 1 dù mở nhiều lần.

Hiểu các hạn chế này, tracking vẫn hữu ích để biết có một số lượng đáng kể email *không* được mở → follow up.

## Retention

Open log tự expire sau 180 ngày (configurable trong `api/t/[token].ts`). Upstash free tier cho 10k command/day, thừa sức cho vài trăm người nhận/tháng.

## Chi phí

- Vercel Hobby: miễn phí — đủ cho vài trăm email/tháng
- Upstash Redis Free: 10k command/day — đủ cho ~5k email/tháng (1 ghi + 1 đọc mỗi email)

## Bảo mật

- Server KHÔNG biết danh tính nhân viên, chỉ thấy token UUID
- Nếu bị leak URL endpoint, kẻ tấn công có thể spam `/api/t/{random}.gif` → chỉ tạo entry Redis vô nghĩa. Có thể thêm rate limit sau.
- `/api/opens` hỗ trợ bearer auth: set env `TRACKER_SECRET` trên Vercel và paste cùng giá trị vào **Cài đặt → Tracker secret** trong app. Nếu không set, endpoint mở (ai có token cũng query được) — chỉ nên dùng khi tự tin token không leak.
- Muốn chặt hơn nữa: thêm HMAC signature trong token (chống replay) hoặc allowlist IP.

### Bật auth (khuyến nghị)

```bash
# 1. Sinh secret random
openssl rand -base64 32

# 2. Set env trên Vercel
vercel env add TRACKER_SECRET production
# paste secret ở trên

# 3. Redeploy
vercel --prod

# 4. Trong app → Cài đặt → "Tracker secret" → paste, Lưu
```
