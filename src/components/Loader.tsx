import React from 'react';
import ReactLoading from 'react-loading';
import styled, { CSSProperties } from 'styled-components';

const LoaderDiv = styled.div`
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 200px;
  display: flex;
  align-items: center;
  padding: 4px;
  margin-left: -4px;
`;

const Loader = () => {
  return (
    <LoaderDiv>
      <ReactLoading type={'spokes'} color="#fff" height={667} width={375} />
    </LoaderDiv>
  );
};

export { Loader };
