// Configuração pública do app web "EasyFoot" no Firebase (projeto easyfoot-app).
// Esses valores identificam o projeto e são feitos para ficar no front-end;
// a segurança vem das regras do Firebase e dos domínios autorizados.
export const firebaseConfig = {
  apiKey: "AIzaSyCLYc8m7Lj1rPQSVpWt_lfSQOgSie5tR14",
  // Login servido pelo próprio domínio (ver functions/__/auth). Em desenvolvimento usa o padrão.
  authDomain: typeof location !== "undefined" && location.hostname.endsWith("easyfoot.pages.dev") ? "easyfoot.pages.dev" : "easyfoot-app.firebaseapp.com",
  projectId: "easyfoot-app",
  storageBucket: "easyfoot-app.firebasestorage.app",
  messagingSenderId: "946965363704",
  appId: "1:946965363704:web:be115d1a7eac9cc54df40d",
};
