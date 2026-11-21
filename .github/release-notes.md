<div align="center">

<img src="https://raw.githubusercontent.com/zekuuu/clario/main/frontend/public/assets/clario-logo_dark.png" width="96" alt="Clario logo">

# Clario {{VERSION}}

**Compare, validate and audit spreadsheet data on your own PC.**

</div>

> [!NOTE]
> This is a pre-release. It works end to end, but it is still early. Please report problems in [Issues](https://github.com/zekuuu/clario/issues).

## Download

<p align="center">
<a href="https://github.com/zekuuu/clario/releases/download/v{{VERSION}}/Clario_{{VERSION}}_x64-setup.exe"><img src="https://raw.githubusercontent.com/zekuuu/clario/main/.github/assets/download-windows.svg" alt="Download Clario {{VERSION}} for Windows" width="300"></a>
</p>

## What Clario does

- **Compare spreadsheets:** match rows across files and check descriptions, quantities, units and prices.
- **Build your own checks:** map fields between files and set the comparison rules in the Comparison Builder.
- **Export reports:** save a PDF with the summary and every discrepancy found.
- **Pick up where you left off:** sessions keep your files, setup and results.
- **Stays on your PC:** nothing is sent over the internet.

## Install

1. Download and run the setup.
2. Choose **Just me** (no admin rights needed) or **Everyone on this PC**.
3. Choose the install folder, or keep the default.
4. Start Clario from the Start menu.

> [!IMPORTANT]
> The setup is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Click **More info**, then **Run anyway**. Some antivirus programs may also flag it.

## Where your data is stored

Sessions, uploaded copies and reports are kept in the `data` folder inside the install folder.
- **Updating:** installing a new version over the old one keeps your data.
- **Uninstalling:** your data is kept unless you tick **Also delete my sessions and reports**.
- **Everyone on this PC:** in this mode, all Windows accounts on the PC share the same sessions.

Used an earlier development build? Clario finds the old data in `%USERPROFILE%\.clario` on first start and offers to **move** it, **copy** it, or **start fresh**.

## Known limitations

- Windows only.
- No automatic updates yet: download new versions from this page.
- The first start can take up to a minute while the local service starts.
