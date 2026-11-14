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
    'demo-earth-seasons',
    'demo-phone-call',
    'demo-condensation',
    'demo-projectile',
    'demo-storm-cloud',
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

    // 1. Curated Top-Quality Masterpiece Videos (6 Video Vật lý Trình chiếu chất lượng cao nhất)
    const curatedDemos: AlbumVideoItem[] = [
      {
        id: 'demo-rainbow',
        title: 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
        subject: 'Vật lý',
        duration: '00:56',
        durationSeconds: 56,
        createdAt: '2026-11-14T00:40:00.000Z',
        formattedDate: '14/11/2026',
        thumbnailUrl: '/demo/thumb-rainbow-frame.png',
        videoUrl: '/demo/rainbow-exact-clone.mp4',
        downloadUrl: '/demo/rainbow-exact-clone.mp4',
        isSaved: true,
        description: 'Giải thích hiện tượng tán sắc ánh sáng mặt trời qua các giọt nước mưa, góc khúc xạ 42° tạo dải 7 sắc cầu vồng theo định luật Snell và chuẩn quang học.',
        isDemo: true,
      },
      {
        id: 'demo-earth-seasons',
        title: 'Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?',
        subject: 'Vật lý',
        duration: '00:56',
        durationSeconds: 56,
        createdAt: '2026-11-14T00:35:00.000Z',
        formattedDate: '14/11/2026',
        thumbnailUrl: '/demo/thumb-seasons-frame.png',
        videoUrl: '/demo/seasons-exact-clone.mp4',
        downloadUrl: '/demo/seasons-exact-clone.mp4',
        isSaved: true,
        description: 'Giải mã hiện tượng các mùa do trục Trái Đất nghiêng 23,5° không đổi khi quay quanh Mặt Trời, góc chiếu thẳng vs góc chiếu xiên và sự chênh lệch thời lượng ngày đêm tại Hà Nội.',
        isDemo: true,
      },
      {
        id: 'demo-phone-call',
        title: 'Làm thế nào điện thoại thông minh kết nối cuộc gọi?',
        subject: 'Vật lý',
        duration: '01:26',
        durationSeconds: 86,
        createdAt: '2026-11-14T00:30:00.000Z',
        formattedDate: '14/11/2026',
        thumbnailUrl: '/demo/thumb-phone-frame.png',
        videoUrl: '/demo/phone-call-exact-clone.mp4',
        downloadUrl: '/demo/phone-call-exact-clone.mp4',
        isSaved: true,
        description: 'Mô phỏng trường sóng điện từ, quỹ đạo truyền tín hiệu vô tuyến RF và cơ chế liên lạc giữa điện thoại di động và trạm BTS.',
        isDemo: true,
      },
      {
        id: 'demo-condensation',
        title: 'Vì sao ngoài lon nước lạnh xuất hiện giọt sương?',
        subject: 'Vật lý',
        duration: '01:02',
        durationSeconds: 62,
        createdAt: '2026-11-14T00:25:00.000Z',
        formattedDate: '14/11/2026',
        thumbnailUrl: '/demo/thumb-condensation-frame.png',
        videoUrl: '/demo/condensation-exact-clone.mp4',
        downloadUrl: '/demo/condensation-exact-clone.mp4',
        isSaved: true,
        description: 'Khám phá nhiệt động học phân tử, cơ chế chuyển pha khí - lỏng khi không khí ẩm gặp bề mặt lạnh hạ dưới nhiệt độ điểm sương.',
        isDemo: true,
      },
      {
        id: 'demo-projectile',
        title: 'Chuyển động ném ngang và phân tích quỹ đạo parabol',
        subject: 'Vật lý',
        duration: '01:00',
        durationSeconds: 60,
        createdAt: '2026-11-14T00:20:00.000Z',
        formattedDate: '14/11/2026',
        thumbnailUrl: '/demo/thumb-projectile-motion.png',
        videoUrl: '/demo/projectile-motion.mp4',
        downloadUrl: '/demo/projectile-motion.mp4',
        isSaved: true,
        description: 'Phân tích chuyển động ném ngang thành hai thành phần độc lập: chuyển động thẳng đều theo trục hoành và rơi tự do theo trục tung để tạo thành đường quỹ đạo parabol.',
        isDemo: true,
      },
      {
        id: 'demo-storm-cloud',
        title: 'Vì sao mây thường màu trắng nhưng mây giông lại xám đen?',
        subject: 'Vật lý',
        duration: '00:46',
        durationSeconds: 46,
        createdAt: '2026-11-14T00:15:00.000Z',
        formattedDate: '14/11/2026',
        thumbnailUrl: '/demo/thumb-storm-cloud.png',
        videoUrl: '/demo/storm-cloud.mp4',
        downloadUrl: '/demo/storm-cloud.mp4',
        isSaved: true,
        description: 'Giải thích hiện tượng tán xạ Mie của hàng tỷ giọt nước li ti, độ dày quang học khổng lồ (10-15km) và cơ chế phản xạ ánh sáng nhiều lần khiến đáy mây giông tối sầm.',
        isDemo: true,
      },
    ];

    videos.push(...curatedDemos);

    // Chuẩn hóa từ khóa để loại trừ trùng lặp nội dung
    const seenKeywords = new Set<string>([
      'mùa hè',
      'mùa đông',
      'mua he',
      'mua dong',
      'trục trái đất',
      '23.5',
      'seasons',
      'mây',
      'mây giông',
      'may giong',
      'storm cloud',
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
      'ném ngang',
      'nem ngang',
      'parabol',
      'projectile',
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
      const rawCompletedJobs: any[] = [];

      for (const file of files) {
        try {
          const job = JSON.parse(readFileSync(resolve(jobsDir, file), 'utf8'));
          if (
            job.status === 'completed' &&
            job.outputPath &&
            existsSync(job.outputPath) &&
            job.createdAt &&
            new Date(job.createdAt).getTime() >= new Date('2026-11-13T09:30:00.000Z').getTime()
          ) {
            rawCompletedJobs.push(job);
          }
        } catch {
          // ignore corrupted files
        }
      }

      // Sắp xếp ưu tiên các video MỚI NHẤT lên trước
      rawCompletedJobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      const extraJobs: AlbumVideoItem[] = [];

      for (const job of rawCompletedJobs) {
        try {
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

          // Gán thumbnail là frame đầu tiên của video thực tế
          const thumb = `/api/jobs/${job.jobId}/thumbnail`;

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
        } catch {
          // ignore corrupted files
        }
      }

      // Chỉ lấy thêm các job do người dùng đánh dấu Trình chiếu
      const savedExtraJobs = extraJobs.filter((job) => job.isSaved);
      savedExtraJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      videos.push(...savedExtraJobs);
    }

    // Album video chỉ gồm những video Trình chiếu chất lượng cao
    const presentationVideos = videos.filter((v) => v.isSaved);

    return Response.json({
      success: true,
      total: presentationVideos.length,
      videos: presentationVideos,
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
