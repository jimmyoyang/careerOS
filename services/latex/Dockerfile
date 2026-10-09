FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends texlive-xetex texlive-lang-chinese fonts-texgyre && rm -rf /var/lib/apt/lists/*
WORKDIR /compiler
COPY services/latex/ ./
USER node
ENV LATEX_HOST=0.0.0.0
EXPOSE 3738
CMD ["node", "server.mjs"]
