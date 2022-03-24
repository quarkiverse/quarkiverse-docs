# Quarkiverse Docs

This repository uses [Antora](https://antora.org/) to generate a documentation website for the Quarkiverse extensions.


## Build

To build the documentation website, clone this repository, make sure you have the [Antora CLI installed](https://docs.antora.org/antora/2.3/install/install-antora/) and run the following command:

```
   antora antora-playbook.yml
```

You should see the generated website under `build/site/`.

## CI

This repository is scheduled to build 4 times/day, so don't worry if your documentation changes are not visible immediately once you push to your extension repository. 
