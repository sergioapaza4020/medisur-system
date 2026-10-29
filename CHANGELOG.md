## [1.3.0](https://github.com/sergioapaza4020/medisur-system/compare/v1.2.0...v1.3.0) (2026-10-19)

### Features

* **appointments:** implement rescheduling response flow ([8428f0f](https://github.com/sergioapaza4020/medisur-system/commit/8428f0fff2c7031a5f1c89f3f467309c6a5d69e5))

## [1.2.0](https://github.com/sergioapaza4020/medisur-system/compare/v1.1.0...v1.2.0) (2026-10-19)

### Features

* **account:** implement self-service account settings ([b649e15](https://github.com/sergioapaza4020/medisur-system/commit/b649e15a6655c12bfe9b03e1e21281c28b9f1582))
* **appointments:** implement administrative appointment booking ([93939ac](https://github.com/sergioapaza4020/medisur-system/commit/93939ac9d6e5208d61fc56b00f36c3f228dd59a6))
* **appointments:** implement appointment rescheduling proposals ([17889da](https://github.com/sergioapaza4020/medisur-system/commit/17889da5ae386a9f48e635e25462e57b42b121ae))
* **appointments:** implement doctor appointment agenda ([b26cc83](https://github.com/sergioapaza4020/medisur-system/commit/b26cc836264e9f14c9321db59860ec135c6e0c09))
* **appointments:** implement doctor appointment cancellation ([8d9bb27](https://github.com/sergioapaza4020/medisur-system/commit/8d9bb27d447784ce1dbe8a7ade9cc24015fab49d))
* **appointments:** implement patient appointment booking ([cbf6122](https://github.com/sergioapaza4020/medisur-system/commit/cbf61226ef975f9b988d76ca88310f7cb89161fb))
* **appointments:** implement patient appointment cancellation ([725c8d6](https://github.com/sergioapaza4020/medisur-system/commit/725c8d6822a79f31bafc1f48d7946423f00b76c3))
* **appointments:** implement patient appointment history ([6ab808d](https://github.com/sergioapaza4020/medisur-system/commit/6ab808d5450333ca7fbe94703392280d45a84fac))
* **availability:** implement medical availability query ([ad4241a](https://github.com/sergioapaza4020/medisur-system/commit/ad4241a381da7ee844688eacac98770b1b84fcdb))
* **schedules:** implement doctor availability registration ([ee01a14](https://github.com/sergioapaza4020/medisur-system/commit/ee01a144ede4565fce8e8f272b6c64f3cb509f8e))
* **schedules:** implement schedule update flow ([775e315](https://github.com/sergioapaza4020/medisur-system/commit/775e3153e445a6c8267c74e3b8c4a88db943130d))
* **storage:** configure reusable Neon Storage integration ([0489c25](https://github.com/sergioapaza4020/medisur-system/commit/0489c2530e0604772982b828b1016144dfad2cfb))

## [1.1.0](https://github.com/sergioapaza4020/medisur-system/compare/v1.0.0...v1.1.0) (2026-10-16)

### Features

* **api:** implement reusable pagination ([a50c65d](https://github.com/sergioapaza4020/medisur-system/commit/a50c65d6e31459443869207b9335b0e750209a0f))
* **auth:** add login and dashboard protection ([#2](https://github.com/sergioapaza4020/medisur-system/issues/2)) ([e00b55f](https://github.com/sergioapaza4020/medisur-system/commit/e00b55faa8df32d7b5ea1254f1e8c20265922922))
* **auth:** add register pattients account ui ([6cf20f2](https://github.com/sergioapaza4020/medisur-system/commit/6cf20f24e590c9b6134e9d6050fb6f4c5aecc574))
* **auth:** add users, roles and permissions ([695554e](https://github.com/sergioapaza4020/medisur-system/commit/695554e602f5c20d74fa11ab331599c7867dcbf6)), closes [#6](https://github.com/sergioapaza4020/medisur-system/issues/6)
* **auth:** configure transactional email service ([72e028e](https://github.com/sergioapaza4020/medisur-system/commit/72e028e62a9daef273a2ad343f1c0a48f78d4330))
* **auth:** implement password recovery request flow ([f1f2ce6](https://github.com/sergioapaza4020/medisur-system/commit/f1f2ce683462f7283902dfab59384bcb74c7c8ae))
* **auth:** implement password reset flow ([eb2c520](https://github.com/sergioapaza4020/medisur-system/commit/eb2c52028c3870fcfa53de237fb52b04bbb6c29d))
* **doctors:** add doctors by specialty query ([da057a0](https://github.com/sergioapaza4020/medisur-system/commit/da057a0c1c441d5ab2dfeae1242d4f8e71f03ef2))
* **doctors:** add specialty assignments ([c8b392b](https://github.com/sergioapaza4020/medisur-system/commit/c8b392b538b929cae482bff318b6b4c7ad1b1655))
* **doctors:** implement specialist doctor registration ([125b2f0](https://github.com/sergioapaza4020/medisur-system/commit/125b2f057166f0339f3a4dd196223eb15d3fc255))
* **mail:** add mail flux (uncomplete) ([8d6e742](https://github.com/sergioapaza4020/medisur-system/commit/8d6e7422579479d5eaad06c089d011bca4dbc3ea))
* **patients:** implement administrative register for patients ([33da958](https://github.com/sergioapaza4020/medisur-system/commit/33da958c0525dcf9c60cbe30fe7dd34681a7c706))
* **permissions:** manage permissions associated to roles ([183c8ff](https://github.com/sergioapaza4020/medisur-system/commit/183c8ffebb4067ff559630d714b39a1be3db48ec))
* **roles:** implement roles management ([d6004b6](https://github.com/sergioapaza4020/medisur-system/commit/d6004b62efbfca1e3586f377c9e16f9de2cda8a4))
* **specialties:** implement medical specialties management ([8e5656b](https://github.com/sergioapaza4020/medisur-system/commit/8e5656b4db17d8f9f25e81aac6fa301ccf5baba3))
* **ui:** implement public MEDISUR landing page ([8facdd7](https://github.com/sergioapaza4020/medisur-system/commit/8facdd7cfa947537b73ed24706f2fe523b795ad0))
* **users:** add users' administration ([4d410ad](https://github.com/sergioapaza4020/medisur-system/commit/4d410ad391d1cad3824540e0f67e21f27632433f)), closes [#5](https://github.com/sergioapaza4020/medisur-system/issues/5)

## 1.0.0 (2026-10-06)

### Features

* **common:** initial commit ([c8039f6](https://github.com/sergioapaza4020/medisur-system/commit/c8039f6f1155276e3fd91c5aa0a2d6e07d69cb48))
