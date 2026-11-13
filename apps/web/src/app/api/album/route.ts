import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRequestAuthorized, resolveOwnerId, SecurityError } from '@/server/security';

export const runtime = 'nodejs';

function getRepositoryRoot(): string {
  const c1 = resolve(process.cwd(), 'outputs/.jobs');
  if (existsSync(c1)) return process.cwd();
  const c2 = resolve(process.cwd(), '..', 'outputs/.jobs');
  if (existsSync(c2)) return resolve(process.cwd(), '..');
  const c3 = resolve(process.cwd(), '../..', 'outputs/.jobs');
  if (existsSync(c3)) return resolve(process.cwd(), '../..');
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../');
}

const repositoryRoot = getRepositoryRoot();
const jobsDir = resolve(repositoryRoot, 'outputs/.jobs');
const draftsDir = resolve(repositoryRoot, 'outputs/.drafts-v3');
const savedStoreFile = resolve(repositoryRoot, 'outputs/.saved-videos.json');

export interface AlbumVideoItem {
  id: string;
  title: string;
  subject: string;
  duration: string;
  durationSeconds: number;
  createdAt: string;
  formattedDate: string;
  thumbnailUrl: string;
  videoUrl: string;
  downloadUrl: string;
  isSaved: boolean;
  description?: string;
  isDemo?: boolean;
}

function loadSavedVideoIds(): Set<string> {
  try {
    if (existsSync(savedStoreFile)) {
      const data = JSON.parse(readFileSync(savedStoreFile, 'utf8'));
      if (Array.isArray(data)) return new Set(data);
    }
  } catch {
    // ignore
  }
  return new Set([
    'demo-rainbow',
    'demo-phone-call',
    'demo-condensation',
    'demo-math-pythagoras',
    'demo-gradient-descent',
    'demo-secant-tangent',
  ]);
}

function saveSavedVideoIds(ids: Set<string>): void {
  try {
    const dir = dirname(savedStoreFile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(savedStoreFile, JSON.stringify(Array.from(ids), null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '12/11/2026';
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function GET(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    resolveOwnerId(request);

    const savedIds = loadSavedVideoIds();
    const videos: AlbumVideoItem[] = [];

    // 1. Curated Top-Quality Masterpiece Videos (Ảnh bìa CHUẨN XÁC theo khung hình đầu của video & số giây chính xác)
    const curatedDemos: AlbumVideoItem[] = [
      {
        id: 'demo-rainbow',
        title: 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
        subject: 'Vật lý',
        duration: '00:56',
        durationSeconds: 56,
        createdAt: '2026-11-12T08:00:00.000Z',
        formattedDate: '12/11/2026',
        thumbnailUrl: '/demo/thumb-rainbow-frame.png',
        videoUrl: '/demo/rainbow-exact-clone.mp4',
        downloadUrl: '/demo/rainbow-exact-clone.mp4',
        isSaved: savedIds.has('demo-rainbow'),
        description: 'Giải thích hiện tượng tán sắc ánh sáng mặt trời qua các giọt nước mưa, góc khúc xạ 42° tạo dải 7 sắc cầu vồng theo định luật Snell và chuẩn quang học.',
        isDemo: true,
      },
      {
        id: 'demo-phone-call',
        title: 'Làm thế nào điện thoại thông minh kết nối cuộc gọi?',
        subject: 'Vật lý',
        duration: '01:26',
        durationSeconds: 86,
        createdAt: '2026-11-11T09:30:00.000Z',
        formattedDate: '11/11/2026',
        thumbnailUrl: '/demo/thumb-phone-frame.png',
        videoUrl: '/demo/phone-call-exact-clone.mp4',
        downloadUrl: '/demo/phone-call-exact-clone.mp4',
        isSaved: savedIds.has('demo-phone-call'),
        description: 'Mô phỏng trường sóng điện từ, quỹ đạo truyền tín hiệu vô tuyến RF và cơ chế liên lạc giữa điện thoại di động và trạm BTS.',
        isDemo: true,
      },
      {
        id: 'demo-condensation',
        title: 'Vì sao ngoài lon nước lạnh xuất hiện giọt sương?',
        subject: 'Vật lý',
        duration: '01:02',
        durationSeconds: 62,
        createdAt: '2026-11-10T14:15:00.000Z',
        formattedDate: '10/11/2026',
        thumbnailUrl: '/demo/thumb-condensation-frame.png',
        videoUrl: '/demo/condensation-exact-clone.mp4',
        downloadUrl: '/demo/condensation-exact-clone.mp4',
        isSaved: savedIds.has('demo-condensation'),
        description: 'Khám phá nhiệt động học phân tử, cơ chế chuyển pha khí - lỏng khi không khí ẩm gặp bề mặt lạnh hạ dưới nhiệt độ điểm sương.',
        isDemo: true,
      },
      {
        id: 'demo-math-pythagoras',
        title: '7 Hằng đẳng thức đáng nhớ & Biến đổi đại số',
        subject: 'Toán học',
        duration: '00:35',
        durationSeconds: 35,
        createdAt: '2026-11-09T10:00:00.000Z',
        formattedDate: '09/11/2026',
        thumbnailUrl: '/demo/thumb-algebra-frame.png',
        videoUrl: '/demo/algebra-identities.mp4',
        downloadUrl: '/demo/algebra-identities.mp4',
        isSaved: savedIds.has('demo-math-pythagoras'),
        description: 'Mô hình hóa hình học và các phép biến đổi đại số cơ bản với 7 hằng đẳng thức đáng nhớ.',
        isDemo: true,
      },
      {
        id: 'demo-gradient-descent',
        title: 'Thuật toán Gradient Descent & Tối ưu hóa hàm mất mát',
        subject: 'Tin học / AI',
        duration: '03:40',
        durationSeconds: 220,
        createdAt: '2026-11-12T15:36:20.000Z',
        formattedDate: '12/11/2026',
        thumbnailUrl: '/demo/thumb-gradient-descent.png',
        videoUrl: '/demo/gradient-descent.mp4',
        downloadUrl: '/demo/gradient-descent.mp4',
        isSaved: savedIds.has('demo-gradient-descent'),
        description: 'Mô phỏng 3D thuật toán tối ưu hóa lặp Gradient Descent, đồ thị bề mặt hàm mất mát và cơ chế cập nhật trọng số trong mạng nơ-ron học sâu.',
        isDemo: true,
      },
      {
        id: 'demo-secant-tangent',
        title: 'Bản chất hình học của đạo hàm: Từ cát tuyến đến tiếp tuyến',
        subject: 'Toán học',
        duration: '03:42',
        durationSeconds: 222,
        createdAt: '2026-11-12T04:44:02.000Z',
        formattedDate: '12/11/2026',
        thumbnailUrl: '/demo/thumb-secant-tangent.png',
        videoUrl: '/demo/secant-tangent-derivative.mp4',
        downloadUrl: '/demo/secant-tangent-derivative.mp4',
        isSaved: savedIds.has('demo-secant-tangent'),
        description: 'Trực quan hóa giới hạn hệ số góc của đường cát tuyến khi khoảng cách Δx tiến dần về 0 để trở thành đường tiếp tuyến và dẫn xuất công thức đạo hàm.',
        isDemo: true,
      },
    ];

    videos.push(...curatedDemos);

    // Chuẩn hóa từ khóa để loại trừ trùng lặp nội dung
    const seenKeywords = new Set<string>([
      'cầu vồng',
      'cau vong',
      'rainbow',
      'tán sắc',
      'điện thoại',
      'dien thoai',
      'phone',
      'cuộc gọi',
      'sóng',
      'ngưng tụ',
      'ngung tu',
      'lon nước',
      'lon nuoc',
      'sương',
      'dew point',
      'pythagor',
      'hằng đẳng thức',
      'hang dang thuc',
      'algebra',
      'gradient',
      'descent',
      'tối ưu hóa',
      'cát tuyến',
      'cat tuyen',
      'tiếp tuyến',
      'tiep tuyen',
      'đạo hàm',
      'dao ham',
    ]);

    // 2. Quét các video hoàn tất thật khác từ storage do người dùng tạo và KHÔNG ĐƯỢC TRÙNG LẶP
    if (existsSync(jobsDir)) {
      const files = readdirSync(jobsDir).filter((f) => f.endsWith('.json'));
      const extraJobs: AlbumVideoItem[] = [];

      for (const file of files) {
        try {
          const job = JSON.parse(readFileSync(resolve(jobsDir, file), 'utf8'));
          // Chỉ lấy các job đã render thành công và có file video thật tồn tại, bỏ qua các job mock test cũ từ CI/test suite
          if (
            job.status === 'completed' &&
            job.outputPath &&
            existsSync(job.outputPath) &&
            job.createdAt &&
            new Date(job.createdAt).getTime() >= new Date('2026-11-13T09:30:00.000Z').getTime()
          ) {
            let title = '';
            let domain = 'Vật lý';
            let durationSeconds = 60;
            let description = '';

            if (job.draftId) {
              const draftPath = resolve(draftsDir, `${job.draftId}.json`);
              if (existsSync(draftPath)) {
                const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
                title = draft.lessonPlan?.title || draft.request?.topic || '';
                description = draft.lessonPlan?.summary || '';
                durationSeconds =
                  draft.lessonPlan?.storyboard?.totalDurationSeconds ||
                  draft.request?.targetDurationSeconds ||
                  60;
                const d = draft.lessonPlan?.domain || draft.request?.domain;
                if (d === 'mathematics') domain = 'Toán học';
                else if (d === 'physics') domain = 'Vật lý';
                else if (d === 'chemistry') domain = 'Hóa học';
                else if (d === 'biology') domain = 'Sinh học';
                else if (d === 'artificial_intelligence') domain = 'Tin học / AI';
              }
            }

            if (!title) {
              continue; // Bỏ qua các job không có kịch bản hoặc tên rõ ràng
            }

            // Kiểm tra trùng lặp với danh sách mẫu
            const titleLower = title.toLowerCase().trim();
            let isDuplicate = false;
            for (const kw of seenKeywords) {
              if (titleLower.includes(kw)) {
                isDuplicate = true;
                break;
              }
            }
            if (isDuplicate) continue;

            // Đánh dấu từ khóa đã xuất hiện
            seenKeywords.add(titleLower);

            // Gán thumbnail chuẩn xác theo nội dung
            let thumb = '/demo/thumb-rainbow-frame.png';
            if (domain === 'Toán học' || /toán|hình|tích phân|đạo hàm/i.test(title)) {
              thumb = '/demo/thumb-algebra-frame.png';
            } else if (/nguyên tử|hóa học|phân tử|atom/i.test(title)) {
              thumb = '/thumb-atom.png';
            } else if (/ném|chuyển động|vận tốc|gia tốc/i.test(title)) {
              thumb = '/thumb-projectile.png';
            }

            extraJobs.push({
              id: job.jobId,
              title,
              subject: domain,
              duration: formatDuration(durationSeconds),
              durationSeconds,
              createdAt: job.createdAt || new Date().toISOString(),
              formattedDate: formatDate(job.createdAt || new Date().toISOString()),
              thumbnailUrl: thumb,
              videoUrl: `/api/jobs/${job.jobId}/video`,
              downloadUrl: `/api/jobs/${job.jobId}/video?download=1`,
              isSaved: savedIds.has(job.jobId),
              description,
              isDemo: false,
            });
          }
        } catch {
          // ignore corrupted files
        }
      }

      extraJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      videos.push(...extraJobs);
    }

    return Response.json({
      success: true,
      total: videos.length,
      videos,
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json({ error: 'failed_to_load_album', message: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertRequestAuthorized(request);
    resolveOwnerId(request);

    const body = await request.json();
    const { videoId, isSaved } = body;
    if (!videoId || typeof videoId !== 'string') {
      return Response.json({ error: 'invalid_video_id' }, { status: 400 });
    }

    const savedIds = loadSavedVideoIds();
    if (isSaved) {
      savedIds.add(videoId);
    } else {
      savedIds.delete(videoId);
    }
    saveSavedVideoIds(savedIds);

    return Response.json({ success: true, videoId, isSaved: savedIds.has(videoId) });
  } catch (error) {
    if (error instanceof SecurityError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json({ error: 'failed_to_save_video' }, { status: 500 });
  }
}
