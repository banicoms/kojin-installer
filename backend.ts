export interface Env {
  // لینک دانلود فایل‌های بیلد شده از مخزن Private شما
  // این لینک‌ها می‌توانند با یک Personal Access Token گیت‌هاب محافظت شوند
  WORKER_URL: string; 
  SCHEMA_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    
    // Serve HTML (UI Installer)
    if (request.method === 'GET') {
      return new Response("کد HTML فایل index.html که ساخته شد در اینجا قرار می‌گیرد.", {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // هندل کردن فرآیند نصب (POST /api/install)
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { apiToken, tgToken } = body;

        // 1. تنظیمات مشترک API کلودفلر
        const cfHeaders = {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        };

        // دریافت Account ID به صورت اتوماتیک
        const accountRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
          method: 'GET',
          headers: cfHeaders
        });
        const accountData = await accountRes.json();
        if (!accountData.success || accountData.result.length === 0) {
          throw new Error("توکن کلادفلر نامعتبر است یا دسترسی به اکانت ندارد.");
        }
        const accountId = accountData.result[0].id;

        // ==========================================
        // گام ۱: ساخت دیتابیس D1
        // ==========================================
        const dbRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
          method: 'POST',
          headers: cfHeaders,
          body: JSON.stringify({ name: "kojin_db" })
        });
        const dbData = await dbRes.json();
        if (!dbData.success) throw new Error("Failed to create D1 Database");
        const dbId = dbData.result.uuid;

        // ==========================================
        // گام ۲: اجرای Schema روی دیتابیس
        // ==========================================
        // در نسخه اصلی، محتوای schema.sql را از مخزن خصوصی دانلود می‌کنید
        const schemaSql = "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);"; 
        
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
          method: 'POST',
          headers: cfHeaders,
          body: JSON.stringify({ sql: schemaSql })
        });

        // ==========================================
        // گام ۳: آپلود Worker (همراه با بایندینگ دیتابیس و توکن تلگرام)
        // ==========================================
        // در نسخه اصلی، فایل worker.js را از مخزن خصوصی دانلود می‌کنید
        const workerCode = "export default { fetch(req) { return new Response('Kojin Proxy Active'); } }";

        // کلودفلر برای آپلود ورکر نیاز به فرمت multipart/form-data دارد
        // شامل metadata (تعریف D1 و Variables) و خود اسکریپت JS/WASM
        
        /* 
          // نمونه متادیتا برای کلودفلر
          const metadata = {
            main_module: "worker.js",
            bindings: [
              { type: "d1", name: "DB", id: dbId },
              { type: "secret_text", name: "BOT_TOKEN", text: tgToken }
            ]
          }
        */
        // اینجا درخواست PUT به /accounts/../workers/scripts/kojin ارسال می‌شود...
        // ... (کدهای ارسال Multipart)

        // ==========================================
        // گام ۴: ثبت Webhook تلگرام
        // ==========================================
        const workerUrl = `https://kojin.YOUR_SUBDOMAIN.workers.dev`; // آدرس پیش‌فرض کلودفلر
        await fetch(`https://api.telegram.org/bot${tgToken}/setWebhook?url=${workerUrl}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
