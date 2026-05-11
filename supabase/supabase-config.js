window.GCFIND_SUPABASE = {
  url: 'https://evpuhiexnfrehqslcslc.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cHVoaWV4bmZyZWhxc2xjc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNjQ4NTEsImV4cCI6MjA5MTY0MDg1MX0.iIHgLzw073ISr0KrCe0wP6NXMgu9Ky_ja683Rbp4SUU'
};

const { createClient } = supabase;

window.supabaseClient = createClient(
  window.GCFIND_SUPABASE.url,
  window.GCFIND_SUPABASE.anonKey
);