import { PageHeader } from "@/components/page-header";
import { SectionShell } from "@/components/section-shell";

const quickStartSteps = [
  {
    step: "1",
    title: "Mở Settings",
    detail:
      "Bấm nút Settings ở góc trái dưới để kiểm tra trạng thái API key trước khi dùng các chức năng cần OpenRouter.",
  },
  {
    step: "2",
    title: "Kết nối OpenRouter",
    detail:
      "Dán OpenRouter API key, bấm Save, rồi chờ trạng thái Connected. Nếu key đã lưu trong DB thì app sẽ tự kết nối khi khởi động.",
  },
  {
    step: "3",
    title: "Tạo hoặc nhập Job",
    detail:
      "Dùng Import JD để nhập JD từ PDF hoặc tạo job thủ công từ nhu cầu tuyển dụng.",
  },
  {
    step: "4",
    title: "Import CV ứng viên",
    detail:
      "Mở job cần xử lý, sau đó import CV PDF vào đúng workspace để hệ thống gắn ứng viên vào job đó.",
  },
  {
    step: "5",
    title: "Chạy screening và ranking",
    detail:
      "Trong job workspace, bấm Run Screening & Ranking để chấm điểm, kiểm tra evidence và tạo danh sách xếp hạng.",
  },
  {
    step: "6",
    title: "So sánh ứng viên",
    detail:
      "Mở benchmarking để xem song song điểm mạnh, điểm yếu, điểm số và bằng chứng hỗ trợ của các ứng viên nổi bật.",
  },
];

const workflowGroups = [
  {
    title: "Cấu Hình API",
    icon: "vpn_key",
    bullets: [
      "Mở Settings ở góc trái dưới màn hình.",
      "Dán OpenRouter API key vào ô nhập.",
      "Bấm Save và kiểm tra badge chuyển sang Connected.",
      "Nếu badge báo Failed, hãy sửa lại key hoặc reconnect từ cùng khung Settings.",
    ],
  },
  {
    title: "Nhập Job",
    icon: "upload_file",
    bullets: [
      "Bấm Import JD ở thanh bên trái.",
      "Upload file JD PDF hoặc tạo job bằng form thủ công.",
      "Chờ hệ thống parse nội dung và tạo bản ghi job.",
      "Vào Jobs để kiểm tra tiêu đề, dữ liệu đã parse và trạng thái graph sync.",
    ],
  },
  {
    title: "Nhập Ứng Viên",
    icon: "person_add",
    bullets: [
      "Mở đúng job workspace trước khi import CV.",
      "Upload CV PDF để mỗi hồ sơ được gắn với đúng job.",
      "Kiểm tra skills trích xuất, parse status và graph sync sau khi import.",
      "Dùng bulk import khi cần xử lý nhiều CV cho cùng một vị trí.",
    ],
  },
  {
    title: "Đánh Giá",
    icon: "analytics",
    bullets: [
      "Chạy screening sau khi đã import đủ ứng viên.",
      "Xem match score, evidence score, quyết định pass/reject và phần giải thích.",
      "Mở rejected candidates để biết thiếu evidence hay link không hợp lệ.",
      "Dùng ranking để chọn shortlist tốt nhất cho recruiter review.",
    ],
  },
];

const troubleshootingTips = [
  {
    title: "API báo Failed",
    detail:
      "Key OpenRouter chưa đúng hoặc nhà cung cấp từ chối. Mở Settings, thay key khác rồi Save lại cho tới khi hiện Connected.",
  },
  {
    title: "Import JD hoặc CV lỗi",
    detail:
      "Hãy dùng PDF có text thật, không phải file scan ảnh. File chỉ có ảnh thường parse không ổn định.",
  },
  {
    title: "Ứng viên không vào ranking",
    detail:
      "Kiểm tra ứng viên đã được import đúng job chưa và đã bấm Run Screening & Ranking chưa.",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Hướng Dẫn"
        title="Cách sử dụng SkillGraph CV Matcher"
        description="Trang này tóm tắt luồng dùng app: cấu hình API, nhập job, import CV, chạy screening và xem shortlist ngay trong workspace."
      />

      <SectionShell title="Bắt Đầu Nhanh">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {quickStartSteps.map((item) => (
            <article
              key={item.step}
              className="rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{item.detail}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Luồng Sử Dụng">
        <div className="grid gap-5 xl:grid-cols-2">
          {workflowGroups.map((group) => (
            <article
              key={group.title}
              className="rounded-[26px] border border-white/70 bg-white/82 p-6 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(75,65,225,0.10)] text-[var(--color-brand)]">
                  <span className="material-symbols-outlined text-[22px]">{group.icon}</span>
                </span>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                  {group.title}
                </h3>
              </div>
              <div className="mt-5 space-y-3">
                {group.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="flex items-start gap-3 rounded-[18px] border border-[rgba(75,65,225,0.10)] bg-[rgba(248,250,255,0.86)] px-4 py-3"
                  >
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)]" />
                    <p className="text-sm leading-6 text-[var(--color-muted)]">{bullet}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Xử Lý Lỗi">
        <div className="grid gap-5 md:grid-cols-3">
          {troubleshootingTips.map((tip) => (
            <article
              key={tip.title}
              className="rounded-[24px] border border-[rgba(239,68,68,0.12)] bg-[rgba(255,255,255,0.84)] p-6 shadow-[0_18px_50px_rgba(10,20,40,0.05)] backdrop-blur-xl"
            >
              <p className="inline-flex rounded-full bg-[rgba(239,68,68,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
                Support
              </p>
              <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">{tip.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{tip.detail}</p>
            </article>
          ))}
        </div>
      </SectionShell>
    </div>
  );
}
