<div align="center">

# 🎓 AI Study Companion

**An intelligent, AI-powered study platform designed to supercharge your learning journey.**

[![Angular](https://img.shields.io/badge/Angular-20.x-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-API-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![License](https://img.shields.io/badge/License-ISC-green?style=for-the-badge)](LICENSE)

> 🏆 **Graduation Project — Awarded A+**

[📖 API Documentation](#api-documentation) · [🚀 Getting Started](#getting-started) · [👥 Team](#team)

</div>

---

## 📌 Overview

**AI Study Companion** is a full-featured web platform that combines artificial intelligence with collaborative learning tools to help students study smarter. Built as a graduation project, it provides a rich, interactive experience — from AI-powered chat and auto-generated quizzes, to community study groups and personalized learning roadmaps.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🤖 **AI Chat Assistant** | Chat with an AI tutor powered by OpenAI to get instant explanations and study help |
| 📝 **Quiz Generation** | Auto-generate quizzes from your study materials to test your understanding |
| 🗺️ **Learning Roadmaps** | Personalized step-by-step learning paths for any topic or subject |
| 🏘️ **Study Communities** | Join or create community groups to study and share resources with others |
| 📊 **Analytics Dashboard** | Track your learning progress with visual analytics and performance metrics |
| 📄 **Document Reader** | Upload and read PDFs directly in the platform with AI-assisted reading |
| 🏠 **Dashboard** | A central hub showing your activity, progress, and quick access to all features |
| 🔐 **Authentication** | Secure login and registration system with session management |
| 👤 **Profile & Settings** | Manage your personal profile, preferences, and account settings |
| 📚 **Shared Content** | Discover and share study resources with the wider community |

---

## 🖥️ Screenshots

> _Screenshots coming soon!_

<!-- Add screenshots below once available -->
<!-- ![Dashboard](screenshots/dashboard.png) -->
<!-- ![Quiz](screenshots/quiz.png) -->
<!-- ![AI Chat](screenshots/chat.png) -->
<!-- ![Roadmap](screenshots/roadmap.png) -->

---

## 🛠️ Tech Stack

### Frontend
- **[Angular 20](https://angular.dev)** — Main framework (standalone components)
- **[TypeScript 5.9](https://www.typescriptlang.org)** — Type-safe development
- **[TailwindCSS 3.4](https://tailwindcss.com)** — Utility-first CSS styling
- **[ng2-pdf-viewer](https://github.com/VadimDez/ng2-pdf-viewer)** — PDF rendering inside the app
- **[RxJS 7.8](https://rxjs.dev)** — Reactive programming and async data handling

### AI & API
- **[OpenAI API](https://openai.com)** — AI chat and content generation
- **Custom REST API** — Backend services for auth, storage, communities, roadmaps, quizzes, and analytics

### Tooling
- **Angular CLI 20** — Project scaffolding and build system
- **Prettier** — Code formatting
- **Karma + Jasmine** — Unit testing

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- [Angular CLI](https://angular.dev/tools/cli)

```bash
npm install -g @angular/cli
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Naeemx7/ai-study-companion-frontend.git
   cd ai-study-companion-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Update `src/environments/environment.ts`:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'YOUR_BACKEND_API_URL',
     openAiKey: 'YOUR_OPENAI_API_KEY'
   };
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

   The app will be available at `http://localhost:4200/`

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── components/         # Reusable UI components
│   ├── pages/
│   │   ├── auth/           # Login & Registration
│   │   ├── dashboard/      # Main dashboard
│   │   ├── workspace/      # Study workspace & AI chat
│   │   ├── quiz/           # Quiz generation & taking
│   │   ├── roadmap/        # Learning roadmaps
│   │   ├── communities/    # Study groups & communities
│   │   ├── analytics/      # Progress tracking
│   │   ├── profile/        # User profile
│   │   ├── settings/       # Account settings
│   │   ├── shared-content/ # Shared resources
│   │   └── landing/        # Landing page
│   ├── services/           # API & business logic services
│   ├── models/             # TypeScript interfaces & models
│   ├── guards/             # Route guards (auth protection)
│   └── interceptors/       # HTTP interceptors (auth headers)
└── environments/           # Environment configuration
```

---

## 📡 API Documentation

The full REST API specification is included in this repository:

📄 **[`Prefinal-Graduation Api.openapi.json`](./Prefinal-Graduation%20Api.openapi%20.json)**

You can import this OpenAPI spec into tools like:
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Postman](https://www.postman.com/)
- [Apidog](https://apidog.com/)

---

## 👥 Team

This project was built with ❤️ by:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Naeemx7">
        <img src="https://github.com/Naeemx7.png" width="100px" style="border-radius:50%" alt="Naeemx7"/>
        <br />
        <sub><b>Naeemx7</b></sub>
      </a>
      <br />
      🎨 Frontend Developer &amp; UI/UX Designer
    </td>
    <td align="center">
      <a href="https://github.com/SAKR102">
        <img src="https://github.com/SAKR102.png" width="100px" style="border-radius:50%" alt="SAKR102"/>
        <br />
        <sub><b>SAKR102</b></sub>
      </a>
      <br />
      💻 Frontend Developer
    </td>
  </tr>
</table>

---

## 📜 License

This project is licensed under the **ISC License**.

---

<div align="center">

Made with ☕ and lots of late nights &nbsp;·&nbsp; Graduation Project 2026 &nbsp;·&nbsp; **A+ Grade** 🏆

</div>
