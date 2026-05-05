This is a personal fork of the module to get it running on v13. I've used ChatGPT codex heavily and can't vouch that the code is sensible and fine. Use at your own risk.

---

## Release process

Releases are packaged by GitHub Actions. Create or publish a GitHub release with a `v*` tag, or push a `v*` tag, and the workflow will build the module and attach:

- `module.json`
- `module.zip`

To repair an existing release that is missing assets, run the `Release package` workflow manually and enter the existing tag, for example `v2.0.0`.

A foundry module that displays the length of turns in chat! To help you encourage your players to take their turn faster, or to figure out why a 4 round combat lasts 5 hours.

https://github.com/user-attachments/assets/d0927631-b101-4587-87bd-22912c0c033d

Supports the following options:

Compact messages (Defaults to true)  
Minimum turn length to post (Defaults to 5 seconds)  
Post things in chat (Defaults to true)  
Make all messages GM only (Defaults to false)  
Let players see the encounter timer button that logs times (Defaults to true)  
Automatically show encounter timer window (Defaults to false)<br>
Hiding non-player turn lengths (Defaults to false)  
Hiding non-player names (Defaults to false)  
Ignore dead creatures (Defaults to true)  
Post turns (Defaults to true)  
Post rounds (Defaults to true)  
Post combats (Defaults to true)  
Post total turn times at the end (Defaults to true)  
