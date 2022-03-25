import { Web3Provider } from '@ethersproject/providers';
import { OverlayContainer, OverlayProvider } from '@react-aria/overlays';
import { useWeb3React } from '@web3-react/core';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';
import React, { useCallback, useEffect, useState } from 'react';
import { HiOutlineArrowRight } from 'react-icons/hi';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import create, { State } from 'zustand';
import * as api from '../../api';
import { createProfile, CreateProfileRequest } from '../../api/len-query';
import menu from '../../assets/svgs/hamburger.svg';
import { CHAIN_NAMES, DEFAULT_CHAIN_ID, DEV, DISCORD_LINK, ENV } from '../../config/config';
import { useEagerConnect } from '../../hooks/useEagerConnect';
import { useEns } from '../../hooks/useEns';
import { useInactiveListener } from '../../hooks/useInactiveListener';
import { UserProfile } from '../../hooks/useProfile';
import { Label } from '../../styles/typography';
import { getShortenedAddress } from '../../utils/address';
import { getUser, login, getAddress } from '../../utils/len';
import { immer } from '../../utils/zustand';
import { injected, walletconnect } from '../../web3/connectors';
import { switchNetwork } from '../../web3/request';
import { AvatarComponent } from '../AvatarOrb';
import { PrimaryButton } from '../Button';
import { DropDown, ModalDialog } from '../Dialog';
import { Logo } from '../Logo';
import {
  ChainContainer,
  ConnectWallet,
  ConnectWalletPopup,
  DesktopHeaderWrapper,
  Divider,
  DropDownItem,
  Error,
  HeaderWrapperInner,
  HeaderWrapperOuter,
  HEADER_HEIGHT_IN_PX,
  LeftWrapper,
  MenuButton,
  MenuContainer,
  MobileHeaderWrapper,
  RightWrapper,
  StyledSpan,
  Wrapper,
  LinkWrapper,
  DiscordWrapper,
} from './Style';

interface HeaderStore extends State {
  showProfileDropDown: boolean;
  showDialog: boolean;
  hasTriedEagerConnecting: boolean;
  setShowProfileDropDown: (show: boolean) => void;
  setShowDialog: (show: boolean) => void;
  setHasTriedEagerConnecting: (hasEagerConnected: boolean) => void;
}

const useHeaderStore = create<HeaderStore>(
  immer((set) => ({
    showProfileDropDown: false,
    showDialog: false,
    hasTriedEagerConnecting: false,
    setShowProfileDropDown: (show: boolean) => {
      set((draft) => {
        draft.showProfileDropDown = show;
      });
    },
    setShowDialog: (show: boolean) => {
      set((draft) => {
        draft.showDialog = show;
      });
    },
    setHasTriedEagerConnecting: (hasEagerConnected: boolean) => {
      set((draft) => {
        draft.hasTriedEagerConnecting = hasEagerConnected;
      });
    },
  })),
);
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeaderProps {}

const DiscordButton = (props: { onPress: (e: any) => void }) => {
  return (
    <PrimaryButton
      size="small"
      width="small"
      style={{ marginRight: 40, maxWidth: 150, background: '#5865F2', color: 'white' }}
      onPress={props.onPress}
    >
      Join Discord <HiOutlineArrowRight style={{ marginLeft: 5 }} />
    </PrimaryButton>
  );
};
const DesktopHeader = (props: any) => {
  const { loggedInProfile } = props;
  return (
    <DesktopHeaderWrapper>
      <Link to={'/explore'}>
        <StyledSpan style={{ marginRight: 40 }}>Explore</StyledSpan>
      </Link>
      <Link to={'/orders'}>
        <StyledSpan style={{ marginRight: 40 }}>Orders</StyledSpan>
      </Link>
      {!loggedInProfile && (
        <Link to={'/onboarding'}>
          <StyledSpan style={{ marginRight: 40, width: 140 }}>Become a creator</StyledSpan>
        </Link>
      )}
      <DiscordButton
        onPress={() => {
          window.open(DISCORD_LINK);
        }}
      />
    </DesktopHeaderWrapper>
  );
};
const MobileHeader = (props: any) => {
  const { loggedInProfile, userLoggedIn } = props;
  const [visible, setVisible] = useState<boolean>(false);
  const handleClick = () => {
    setVisible(!visible);
  };
  return (
    <>
      <MenuContainer>
        <MenuButton onClick={handleClick}>
          <img src={menu} alt="menu" />
        </MenuButton>
      </MenuContainer>

      {visible ? (
        <Wrapper onClick={handleClick}>
          <MobileHeaderWrapper>
            <Link to={'/explore'} onClick={handleClick}>
              <StyledSpan>Explore</StyledSpan>
            </Link>
            {userLoggedIn && (<Link to={'/orders'} onClick={handleClick}>
              <StyledSpan>Orders</StyledSpan>
            </Link>)}
            {userLoggedIn && !loggedInProfile && (
              <Link to={'/onboarding'} onClick={handleClick}>
                <StyledSpan>Become a creator</StyledSpan>
              </Link>
            )}
            <DiscordButton
              onPress={() => {
                window.open(DISCORD_LINK);
                handleClick();
              }}
            />
          </MobileHeaderWrapper>
        </Wrapper>
      ) : null}
    </>
  );
};
const Header: React.FC<HeaderProps> = () => {
  const [checkLogin, setCheckLogin] = useState<boolean | null>(false);
  const { activate, account, deactivate, chainId } = useWeb3React<Web3Provider>();
  const [chainDialog, setChainDialog] = useState<boolean | null>(false);
  const currentChainName = CHAIN_NAMES[DEFAULT_CHAIN_ID];

  const showLoginDialog = useHeaderStore((s) => s.showDialog);
  const setShowLoginDialog = useHeaderStore((s) => s.setShowDialog);
  const setHasTriedEagerConnecting = useHeaderStore((s) => s.setHasTriedEagerConnecting);

  const showProfileDropDown = useHeaderStore((s) => s.showProfileDropDown);
  const setShowProfileDropDown = useHeaderStore((s) => s.setShowProfileDropDown);
  const dropDropRef = React.useRef<HTMLDivElement>(null);

  const userEnsName = useEns();

  const hasTriedEagerConnect = useEagerConnect();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loggedInProfile, setLoggedInProfile] = useState<Partial<UserProfile> | null>();

  const user = useSelector((state: any) => state.user);
  const [lens, setLens] = useState({});

  const dispatch = useDispatch();

  const navigate = useNavigate();

  useEffect(() => {
    setHasTriedEagerConnecting(hasTriedEagerConnect);
  }, [hasTriedEagerConnect, setHasTriedEagerConnecting]);

  const [currentlyActivating, setCurrentlyActivating] = useState<'metamask' | 'wc' | undefined>(undefined);

  const activeWithMetamask = useCallback(async () => {
    setErrorMessage(null);
    setCurrentlyActivating('metamask');
    try {
      await activate(injected, undefined, true);
      setCheckLogin(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e.name === 'NoEthereumProviderError' || e.message?.includes('No Ethereum provider was found')) {
        setErrorMessage('No MetaMask detected.');
      } else if (
        e.message.includes('Already processing eth_requestAccounts') ||
        e.message.includes(`Request of type 'wallet_requestPermissions'`)
      ) {
        setErrorMessage('Check MetaMask for an existing login request');
      } else if (e.message.includes('The user rejected the request')) {
        setErrorMessage('The MetaMask login was closed, try connecting again');
      } else {
        setErrorMessage(e.message ?? 'Something went wrong logging in');
      }
      setCurrentlyActivating(undefined);
      return;
    }
    setShowLoginDialog(false);
    setTimeout(() => {
      setCurrentlyActivating(undefined);
    }, 1500);
  }, [activate, setShowLoginDialog]);

  const activeWithWalletConnect = useCallback(async () => {
    setErrorMessage(null);

    setCurrentlyActivating('wc');
    try {
      if (walletconnect instanceof WalletConnectConnector) {
        walletconnect.walletConnectProvider = undefined;
      }
      await activate(walletconnect, undefined, true);
      setCheckLogin(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setCurrentlyActivating(undefined);
      setErrorMessage(e.message ?? 'Something went wrong logging in with WalletConnect');
      return;
    }
    setShowLoginDialog(false);
    setTimeout(() => {
      setCurrentlyActivating(undefined);
    }, 1500);
  }, [activate, setShowLoginDialog]);

  const logoutUser = useCallback(async () => {
    deactivate();
    setShowProfileDropDown(false);
    dispatch({ type: 'logout', payload: { user: null } });
    setCheckLogin(false);
    navigate('/');
  }, [deactivate]);

  useInactiveListener(!hasTriedEagerConnect);

  useEffect(() => {
    const getCreatorData = async () => {
      if (account) {
        if (user && user === account) {
          setCheckLogin(true);
        } else if (user && user !== account) {
          dispatch({ type: 'login', payload: { user: account } });
        }
        try {
          const response = await api.creatorById(account || '');
          if (response.data && response.data.creator) {
            setLoggedInProfile(response.data.creator);
          }
        } catch (e) {
          setLoggedInProfile(null);
        }
      }
    };
    getCreatorData();
  }, [account]);

  useEffect(() => {
    if (checkLogin && account) {
      dispatch({ type: 'login', payload: { user: account } });
    }
  }, [checkLogin]);

  useEffect(() => {
    if (chainId !== DEFAULT_CHAIN_ID) {
      setChainDialog(true);
    } else if (chainId) {
      setChainDialog(false);
    }
  }, [chainId]);

  return (
    <>
      <HeaderWrapperOuter>
        <HeaderWrapperInner>
          <LeftWrapper>
            <Link to={'/'}>
              <Logo />
            </Link>
            {DEV && <Label>In DEV environment</Label>}
          </LeftWrapper>
          {hasTriedEagerConnect && (
            <>
              {!checkLogin && (
                <>
                  <RightWrapper>
                    <LinkWrapper>
                      <Link to={'/explore'}>
                        <StyledSpan style={{ marginRight: 40 }}>Explore</StyledSpan>
                      </Link>
                      </LinkWrapper>
                      <DiscordWrapper>
                        <DiscordButton
                          onPress={() => {
                            window.open(DISCORD_LINK);
                          }}
                        />
                      </DiscordWrapper>
                    <PrimaryButton
                      size={'small'}
                      style={{ width: 160 }}
                      variant={'secondary'}
                      onPress={() => setShowLoginDialog(true)}
                    >
                      Login
                    </PrimaryButton>
                    <MobileHeader loggedInProfile={loggedInProfile} userLoggedIn={checkLogin}/>
                  </RightWrapper>
                </>
              )}
              {checkLogin && account && (
                <RightWrapper>
                  <DesktopHeader loggedInProfile={loggedInProfile} />
                  {!loggedInProfile && (
                    <RightWrapper
                      ref={dropDropRef}
                      onClick={() => {
                        setShowProfileDropDown(true);
                      }}
                      style={{ position: 'relative' }}
                    >
                      <StyledSpan style={{ marginRight: 16 }}>
                        {userEnsName ?? getShortenedAddress(account, 6, 4)}
                      </StyledSpan>
                      <AvatarComponent address={account} />
                      {showProfileDropDown && (
                        <OverlayProvider>
                          <DropDown
                            triggerRef={dropDropRef}
                            containerStyles={{}}
                            isOpen={showProfileDropDown}
                            onClose={() => setShowProfileDropDown(false)}
                            isDismissable
                          >
                            <DropDownItem
                              onClick={(e) => {
                                e.stopPropagation();
                                logoutUser();
                              }}
                            >
                              Logout
                            </DropDownItem>
                          </DropDown>
                        </OverlayProvider>
                      )}
                    </RightWrapper>
                  )}
                  {loggedInProfile && (
                    <RightWrapper
                      ref={dropDropRef}
                      onClick={() => {
                        setShowProfileDropDown(true);
                      }}
                      style={{ position: 'relative' }}
                    >
                      <StyledSpan style={{ marginRight: 16 }}>
                        {lens && lens.handle}
                        {!lens ? userEnsName ?? getShortenedAddress(account, 6, 4) : null}
                      </StyledSpan>
                      <AvatarComponent address={account} url={loggedInProfile?.profilePicture} />
                      {showProfileDropDown && (
                        <OverlayProvider>
                          <DropDown
                            triggerRef={dropDropRef}
                            containerStyles={{}}
                            isOpen={showProfileDropDown}
                            onClose={() => setShowProfileDropDown(false)}
                            isDismissable
                          >
                            <Link
                              to={'onboarding/profile'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowProfileDropDown(false);
                              }}
                            >
                              <DropDownItem>Settings</DropDownItem>
                            </Link>
                            <Divider />
                            <DropDownItem
                              onClick={(e) => {
                                e.stopPropagation();
                                logoutUser();
                              }}
                            >
                              Log out
                            </DropDownItem>
                          </DropDown>
                        </OverlayProvider>
                      )}
                    </RightWrapper>
                  )}
                  <MobileHeader loggedInProfile={loggedInProfile} userLoggedIn={checkLogin}/>
                </RightWrapper>
              )}
            </>
          )}
        </HeaderWrapperInner>
      </HeaderWrapperOuter>

      {showLoginDialog && (
        <OverlayContainer>
          <ModalDialog
            containerStyles={{
              border: '1px solid #b3b3b3',
              padding: '24px',
            }}
            isOpen
            onClose={() => setShowLoginDialog(false)}
            isDismissable
          >
            <>
              <ConnectWallet>Connect a wallet</ConnectWallet>
              {errorMessage && <Error>{errorMessage}</Error>}

              <PrimaryButton
                variant={'secondary'}
                style={{ marginBottom: 16, minWidth: 310 }}
                isDisabled={currentlyActivating === 'metamask' && user}
                onPress={async () => {
                  const authRes = await login()
                  // const profile : CreateProfileRequest = {
                  //   handle: '0xjonomnomtest'
                  // }
                  // await createProfile(profile, authRes.data.authenticate.accessToken)
                  const user = await getUser(await getAddress())
                  console.log(user)
                  //TODO - this currently does not handle for the case where user does not have an account
                  setLens(user.data.profiles.items[0])
                  console.log(lens)
                  setShowLoginDialog(false);
                  setCheckLogin(true);
                }}
              >
                <ConnectWalletPopup>
                  {currentlyActivating === 'metamask' ? <>{'Confirm in your wallet'}</> : 'Continue with Metamask'}
                </ConnectWalletPopup>
              </PrimaryButton>

              <PrimaryButton
                variant={'secondary'}
                style={{ marginBottom: 16, minWidth: 310 }}
                isDisabled={currentlyActivating === 'wc' && user}
                onPress={() => activeWithWalletConnect()}
              >
                <ConnectWalletPopup>
                  {currentlyActivating === 'wc' ? <>{'Confirm in your wallet'}</> : 'Continue with mobile wallet'}
                </ConnectWalletPopup>
              </PrimaryButton>
            </>
          </ModalDialog>
        </OverlayContainer>
      )}
      {checkLogin && chainDialog && (
        <>
          <ChainContainer>
              {`Please switch to ${currentChainName}`}
              {ENV === 'PROD' && <NetworkButton onClick={switchNetwork}>Switch Network</NetworkButton> } 
          </ChainContainer>
        </>
      )}
    </>
  );
};

const NetworkButton = styled.button`
  margin-left: 20px;
  font-family: 'Scto Grotesk A';
  font-size: 12px;
  border-radius: 6px;
  padding: 4px;
  background: ${props => props.theme.black};
  color: ${props => props.theme.white};
`

const HeaderSpacer = styled.div`
  height: ${HEADER_HEIGHT_IN_PX};
  width: 100%;
  min-height: ${HEADER_HEIGHT_IN_PX};
  max-height: ${HEADER_HEIGHT_IN_PX};
`;

const SPACE_BETWEEN_HEADER_AND_CONTENT_IN_PX = '88px';
const HeaderContentGapSpacer = styled.div`
  height: ${SPACE_BETWEEN_HEADER_AND_CONTENT_IN_PX};
  width: 100%;
  min-height: ${SPACE_BETWEEN_HEADER_AND_CONTENT_IN_PX};
  max-height: ${SPACE_BETWEEN_HEADER_AND_CONTENT_IN_PX};
`;

export { Header, HeaderContentGapSpacer, HeaderSpacer };
