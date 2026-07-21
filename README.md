# OverKnight

![Godot](https://img.shields.io/badge/Godot-4.4-blue?style=for-the-badge) ![Platformer](https://img.shields.io/badge/Genre-Platformer-green?style=for-the-badge)

**OverKnight** is an iOS-ready Expo/React Native port of [KnightPlatformer](https://github.com/Hernandez712/KnightPlatformer), a simple 2D platformer created with **Godot 4.4**.

The original Godot project is preserved in this repository. The iOS app entry point is `App.tsx`, with Expo configuration in `app.json` and EAS/TestFlight configuration in `eas.json`.

## iOS Deployment

The GitHub Actions workflow at `.github/workflows/testflight.yml` builds the app on a macOS runner with Xcode and uploads the IPA to TestFlight.

Required repository secrets:

- `ASC_API_KEY_ID`
- `ASC_API_KEY_ISSUER_ID`
- `ASC_API_KEY_BASE64`
- `IOS_DIST_P12_BASE64`
- `IOS_DIST_P12_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`

After creating the GitHub repo and authenticating `gh`, populate them from the local machine:

```sh
node scripts/configure-github-secrets.mjs OWNER/REPO
```

App Store Connect app ID: `6793066323`

Bundle ID / SKU: `com.onuniverse.overknight`

Expo project: `@lmonibuijhibu/overknight`

Run locally:

```sh
npm ci
npm run typecheck
npx expo export --platform ios --output-dir dist-ios
```

Deploy from GitHub:

```sh
gh workflow run TestFlight
```

## Original Project

## 🎮 Features
✅ Simple and clean **GDScript** code  
✅ Basic physics and character controls  
✅ Enemies and environmental interactions  
✅ Animation and tilemap usage  
✅ Ideal for educational purposes  

## 📥 Download and Run
You can download the **release version** of the game [here](https://github.com/Hernandez712/KnightPlatformer/releases/tag/Build). Just extract the archive and run the executable file.

### 🔧 Godot
1. Install **[Godot Engine 4.4](https://godotengine.org/download)**
2. Clone the repository:
   ```sh
   git clone https://github.com/Hernandez712/KnightPlatformer.git
   ```

## 📷 Screenshots
![KnightPlatformer Screenshot](https://github.com/Hernandez712/KnightPlatformer/blob/main/Screenshot.png)

## 🤝 Contributing
If you want to improve the game or add new mechanics, feel free to contribute:
- Fork the repository
- Make your changes
- Submit a **Pull Request**

## 📜 License
This project is distributed under the **Unlicense** – you are free to use, modify, and distribute the code without restrictions. For more details, see the [LICENSE](https://unlicense.org/) file.

---
🚀 **Start learning Godot with KnightPlatformer!** If you have any questions, open an issue or join the discussion.
