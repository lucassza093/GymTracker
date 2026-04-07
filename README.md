# 🏋️ GymTracker

PWA de controle de treinos na academia — hospedado no GitHub Pages com dados no Firebase.

## Funcionalidades

- Login com e-mail/senha via Firebase Auth
- Escolha manual do grupo muscular do dia (Perna / Bíceps+Costas / Peito+Ombro+Tríceps)
- Registro livre de séries por exercício (peso + reps + check de concluído)
- Histórico completo de treinos por data
- Gráfico de evolução de peso e volume por exercício
- Contador de frequência semanal e mensal
- Instalável como PWA no iPhone (Safari → Compartilhar → Adicionar à Tela de Início)

## Configuração

### 1. Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto (ex: `gymtracker`)
3. Adicione um **Web App** ao projeto
4. Copie o `firebaseConfig` gerado
5. Cole em `js/firebase-config.js`
6. No Firebase Console, ative:
   - **Authentication → E-mail/Senha**
   - **Firestore Database** (modo produção)

#### Regra de segurança do Firestore (Cole em Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/workouts/{workoutId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 2. Ícones

1. Abra `generate-icons.html` no navegador
2. Baixe os dois ícones gerados (`icon-192.png` e `icon-512.png`)
3. Salve-os na pasta `icons/`

### 3. GitHub Pages

1. Crie um repositório no GitHub (pode ser privado, mas Pages requer público ou Pro)
2. Faça o push:
```bash
git init
git add .
git commit -m "feat: gymtracker PWA"
git remote add origin https://github.com/SEU_USER/SEU_REPO.git
git push -u origin main
```
3. Vá em **Settings → Pages → Source: main branch / root**
4. Acesse `https://SEU_USER.github.io/SEU_REPO/`

## Estrutura

```
├── index.html          # App principal (shell PWA)
├── manifest.json       # Manifesto PWA
├── sw.js               # Service Worker (cache offline)
├── generate-icons.html # Gerador de ícones PNG
├── css/
│   └── app.css         # Estilos
├── js/
│   ├── app.js          # Lógica principal
│   ├── exercises.js    # Lista de exercícios
│   └── firebase-config.js  # ⚠️ Configure aqui
└── icons/
    ├── icon-192.png    # Ícone PWA (gere com generate-icons.html)
    └── icon-512.png
```

## Exercícios incluídos

**Perna:** Leg Press, Leg Press A/P, Panturrilha, Agachamento, Flexora (×2), Flexora A/P, Extensora, Abdutora, Adutora, Elevação, Sumô Livre, Sumô A/P

**Bíceps, Costas e Abdômen:** Remada Máquina, Remada Sentado, Remada Barra T, Tronco (×3), Costas Polia, Banco 3 Apoios, Barra, Rosca Direta, 21 Arnold, Martelo, Rosca Inversa, Banco Unilateral, Rosca Barra H, Scott, Abdômen (×2)

**Peito, Ombro e Tríceps:** Supino, Supino Máquina (×2), Supino livre, Tronco, Voador, Peito Aberto, Remada Alta Barra, Ombro Polia, Desenvolvimento, Tríceps Polia, Tríceps máquina, Bíceps Invertido, Remada, Palma, Mão p/ Frente Alternada
