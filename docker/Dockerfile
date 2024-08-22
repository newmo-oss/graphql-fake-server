FROM node:20-alpine

LABEL maintainer="newmo <newmo-oss@newmo.me>"
LABEL description="Docker Container for GraphQL Fake Server"

ARG GRAPHQL_FAKE_SERVER_VERSION
ENV GRAPHQL_FAKE_SERVER_VERSION ${GRAPHQL_FAKE_SERVER_VERSION:-0.11.0}

RUN npm install -g @newmo/graphql-fake-server@${GRAPHQL_FAKE_SERVER_VERSION} && \
    rm -rf /usr/share/man /tmp/* \
           /root/.npm /root/.node-gyp \
           /usr/lib/node_modules/npm/man \
           /usr/lib/node_modules/npm/doc \
           /usr/lib/node_modules/npm/html

ENV PATH=/usr/lib/node_modules/.bin:$PATH

ENTRYPOINT ["graphql-fake-server"]
