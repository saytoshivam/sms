# Agent Constraints for This Workspace

## ⚠️ CRITICAL — Read Before Every Session

### DO NOT attempt any of the following in this system:
- ❌ Download or install JDK / Java 21 (or any JDK version)
- ❌ Run `./gradlew` or `gradlew.bat` commands (Gradle build will fail due to JDK version mismatch — `Unsupported class file major version 69`)
- ❌ Attempt to resolve SSL certificate issues
- ❌ Run `npm install` or any package manager install that requires internet access
- ❌ Try to fix Java runtime / JAVA_HOME environment issues

### ✅ What to do instead:
- Validate code correctness using the **IDE error checker** (`get_errors` tool) on modified files
- Make code changes, commit, and push to `master`
- The user will **test the application in a different environment** where JDK 21 and internet access are available

### Reason:
This development machine does not have the correct JDK version installed and has restricted internet/SSL access. All runtime testing happens on a separate machine.

---

*This file exists so that AI agents (Copilot, etc.) do not waste time repeatedly attempting the above and can skip straight to code changes + git push.*

