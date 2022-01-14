import { Web3Provider } from '@ethersproject/providers';
import { useWeb3React } from '@web3-react/core';
import axios from 'axios';
import { ethers } from 'ethers';
import { Formik } from 'formik';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import { ZodError } from 'zod';

import { PrimaryButton } from '../../components/Button';
import { HeaderContentGapSpacer, HeaderSpacer } from '../../components/Header';
import { ContentWrapper, PageContentWrapper, PageWrapper } from '../../components/layout/Common';
import { TextField } from '../../components/TextField';
import { API_URL, DEV, HELP_EMAIL, SYMBOL } from '../../config/config';
import { useExchangeContract } from '../../hooks/useContracts';
import { CreateUserDtoFull, GetUserResponse, UserProfile } from '../../hooks/useProfile';
import { useProfile, values } from '../../hooks/useProfile';
import { Description } from '../../styles/typography';
import { formatETH } from '../../utils/format';
import { Address, DeliveryTime, errorHandle, Number, Url } from '../../utils/validation';
import { CreateRequestDto } from '../Booking';
// TODO(johnrjj) - Consolidate final typography into stylesheet
const OnboardTitle = styled.h1`
  font-family: 'Scto Grotesk A';
  font-weight: normal;
  text-align: center;
  font-size: 32px;
  line-height: 140%;
  font-style: normal;
  font-weight: bold;
  max-width: 500px;
  display: block;
  margin: auto;
  margin-bottom: 30px;
`;

const ProfileDetailsContainer = styled.div`
  display: block;
  margin: auto;
  margin-top: 45px;
  max-width: 512px;
  padding: 20px;
`;

const OnboardProfile = styled.img`
  border-radius: 50%;
  display: block;
  margin: auto;
  width: 124px;
  height: 124px;
`;

const OnboardProfilePage = () => {
  const userProfile = useProfile();
  const { account, library } = useWeb3React<Web3Provider>();
  const exchangeContract = useExchangeContract(true);
  const [loading, setLoading] = useState(false);
  const [hasAccount, setHasAccount] = useState<boolean>(false);
  const [userProfileDB, setUserProfileDB] = useState<GetUserResponse>();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<boolean>(false);
  const updateUserProfile = async (vals: CreateUserDtoFull) => {
    //for auth
    const messageToBeSigned = 'I am updating my profile in Clipto';
    const msg = `0x${Buffer.from(messageToBeSigned, 'utf8').toString('hex')}`;
    const signature = await library?.send('personal_sign', [msg, account]);

    vals.message = messageToBeSigned;
    vals.signed = signature;

    try {
      await axios.put(`${API_URL}/user/${vals.address}`, { ...vals });
    } catch (err: any) {
      toast.error(err.message)
    }
  }
  const createUserProfile = async (vals: CreateUserDtoFull) => {
    const profile = values(userProfile);
    //TODO: when user declines 2nd transaction, we need to remove the user from db or need to check if user is in contracts
    //for auth

    //bug when not enough money

    try {
      const txResult = await exchangeContract.registerCreator(userProfile.userName!)
      toast.success('Profile created, waiting for confirmation!');
      await txResult.wait();
      toast.success('Success!');
    } catch (err: any) {
      //if txResult fails then print transaction error message
      if (err.message) {
        toast.error(err.message)
      } else if (err.data && err.data.message) {
        toast.error(err.data.message)
      }
    }

    const messageToBeSigned = 'I am onboarding to Clipto';
    const msg = `0x${Buffer.from(messageToBeSigned, 'utf8').toString('hex')}`;
    let signature;
    try {
      signature = await library?.send('personal_sign', [msg, account]);
    } catch (err: any) {
      toast.error(err.message)
      return;
    }
    vals.message = messageToBeSigned;
    vals.signed = signature;
    let verificationResult
    try {
      verificationResult = await axios.post(`${API_URL}/user/create`, { ...vals });
      navigate(`/creator/${userProfile.address}`);
    } catch (err: any) {
      toast.error(err.message)
    }

  };

  useEffect(() => {
    if (account) {
      //if userProfile does not have tweetUrl
      axios.get<GetUserResponse>(`${API_URL}/user/${account}`).then(res => {
        // if creator is found then set up userProfile
        if (res.status === 200) {
          //creator found
          setHasAccount(true);
          setUserProfileDB({ ...res.data })

          // userProfile.setAddress(res.data.address);
          // userProfile.setBio(res.data.bio);
          // userProfile.setDeliveryTime(res.data.deliveryTime);
          // userProfile.setDemos(res.data.demos);
          // userProfile.setPrice(parseFloat(res.data.price));
          // userProfile.setProfilePicture(res.data.profilePicture);
          // userProfile.setTweetUrl(res.data.twitterHandle);
          // userProfile.setUsername(res.data.userName);

          //navigate('/onboarding/profile')
        } else {
          throw 'Something is wrong'
        }
        setLoaded(true)
      }).catch(() => {
        if (!userProfile.tweetUrl) {
          //if creator is not found and userProfile has not verified twitter then...
          navigate('/onboarding');
        } else {
          setLoaded(true)
        }
      })
    }
  }, [account]);
  useEffect(() => {
    console.log(userProfile)
    console.log(userProfileDB)
  }, [userProfile.address, userProfileDB?.id])
  return (
    <>
      {loaded && (
        <PageWrapper>
          <HeaderSpacer />
          <HeaderContentGapSpacer />
          <PageContentWrapper>
            <ContentWrapper>
              <ProfileDetailsContainer>
                <OnboardTitle style={{ marginBottom: '50px' }}>{hasAccount ? "Edit your creator profile" : "Set up your creator profile"}</OnboardTitle>
                <OnboardProfile
                  style={{ marginBottom: '50px' }}
                  src={userProfile.profilePicture || userProfileDB?.profilePicture}
                  alt="user profile picture"
                />
                <Formik
                  initialValues={{
                    bio: userProfile.bio || userProfileDB?.bio || '',
                    userName: userProfile.userName || userProfileDB?.userName || '',
                    profilePicture: userProfile.profilePicture || userProfileDB?.profilePicture || '',
                    deliveryTime: userProfile.deliveryTime?.toString() || userProfileDB?.deliveryTime?.toString() || '',
                    price: userProfile.price?.toString() || userProfileDB?.price?.toString() || '',
                    tweetUrl: userProfile.tweetUrl || '',
                    address: userProfile.address || account || '',
                    demo1: userProfile.demos[0] || userProfileDB?.demos[0] || '',
                    demo2: userProfile.demos[1] || userProfileDB?.demos[1] || '',
                    demo3: userProfile.demos[2] || userProfileDB?.demos[2] || '',
                  }} //TODO(jonathanng) - change to fetched values
                  onSubmit={async (values) => {
                    setLoading(true);
                    // userProfile.setAddress(values.address);
                    // userProfile.setBio(values.bio);
                    // userProfile.setDeliveryTime(parseInt(values.deliveryTime));
                    const demos = [];
                    values.demo1 && demos.push(values.demo1);
                    values.demo2 && demos.push(values.demo2);
                    values.demo3 && demos.push(values.demo3);
                    // userProfile.setDemos(demos);
                    // userProfile.setPrice(parseFloat(values.price));
                    // userProfile.setProfilePicture(values.profilePicture);
                    // userProfile.setTweetUrl(values.tweetUrl);
                    // userProfile.setUsername(values.userName);
                    //for some reason, the above set values do not work immediately, if you submit the form twice this will work else null
                    const vals = {
                      ...values,
                      demos,
                      deliveryTime: parseInt(values.deliveryTime),
                      price: parseFloat(values.price),
                    };
                    hasAccount ? await updateUserProfile(vals) : await createUserProfile(vals);
                    setLoading(false)
                  }}
                  validate={(values) => {
                    const errors: any = {};
                    const { bio, userName, profilePicture, deliveryTime, price, tweetUrl, address } = values;
                    const demo1 = values['demo1'];
                    const demo2 = values['demo2'];
                    const demo3 = values['demo3'];

                    if (bio == '') {
                      errors.bio = 'Please enter a bio.';
                    }
                    if (userName == '') {
                      errors.userName = 'Username cannot be empty.';
                    }
                    if (profilePicture == '') {
                      errors.profilePicture = 'Profile picture can not be empty.';
                    } else {
                      try {
                        Url.parse(profilePicture);
                      } catch (error) {
                        errors.profilePicture = 'Profile picture must be an url.';
                      }
                    }
                    const dTime: number = parseInt(deliveryTime);
                    try {
                      Number.parse(dTime);
                      if (dTime.toString() != deliveryTime) {
                        errors.deliveryTime = 'Delivery time cannot be a decimal or have leading zeros.';
                      }
                      if (dTime <= 0) {
                        errors.deliveryTime = 'Delivery time must be greater than 0 days.';
                      }
                    } catch (error) {
                      errors.deliveryTime = 'Delivery time is not a number.';
                    }


                    //TODO(jonathanng) - bad code
                    try {
                      console.log(demo1)
                      demo1 != '' && Url.parse(demo1);
                    } catch {
                      errors.demo1 = 'This link is invalid.';
                    }

                    try {
                      console.log(demo2)
                      demo2 != '' && Url.parse(demo2);
                    } catch {
                      errors.demo2 = 'This link is invalid.';
                    }

                    try {
                      console.log(demo3)
                      demo3 != '' && Url.parse(demo3);
                    } catch {
                      errors.demo3 = 'This link is invalid.';
                    }
                    const p: number = parseFloat(price);
                    try {
                      Number.parse(p);
                      if (p <= 0) {
                        errors.price = 'Price must be greater than 0.';
                      }
                    } catch (error) {
                      errors.price = 'Price is not a number.';
                    }
                    //update profile does not need this validation
                    if (!hasAccount) {
                      if (tweetUrl == '') {
                        errors.tweetUrl = 'Tweet url can not be empty.';
                      } else {
                        try {
                          Url.parse(tweetUrl);
                        } catch (error) {
                          errors.tweetUrl = 'Tweet url must be an url.';
                        }
                      }
                    }

                    try {
                      Address.parse(address);
                    } catch (error) {
                      errors.address = 'Please enter a valid address.';
                    }
                    return errors;
                  }}
                  validateOnBlur={false}
                  validateOnChange={false}
                >
                  {({ handleChange, handleBlur, handleSubmit, values, errors, touched, validateForm }) => {
                    return (
                      <>
                        <div style={{ marginBottom: 48 }}>
                          <TextField
                            onChange={handleChange('userName')}
                            label="Name"
                            placeholder={values.userName}
                            value={values.userName}
                            onBlur={handleBlur}
                            errorMessage={errors.userName}
                          />
                        </div>

                        <div style={{ marginBottom: 48 }}>
                          <TextField
                            label="Wallet Address"
                            description="You will receive payments to this address"
                            isReadOnly={true}
                            placeholder={account!}
                            value={account!}
                            onBlur={handleBlur}
                            errorMessage={errors.address}
                          />
                        </div>

                        <div style={{ marginBottom: 48 }}>
                          <TextField
                            inputElementType="textarea"
                            onChange={handleChange('bio')}
                            label="Bio"
                            placeholder={'Say something nice'}
                            value={values.bio}
                            onBlur={handleBlur}
                            errorMessage={errors.bio}
                          />
                        </div>

                        <div style={{ marginBottom: 48 }}>
                          <TextField
                            onChange={handleChange('deliveryTime')}
                            label="Minimum time to deliver"
                            type="number"
                            placeholder="3"
                            value={values.deliveryTime}
                            endText="Days"
                            onBlur={handleBlur}
                            errorMessage={errors.deliveryTime}
                          />
                        </div>

                        <div style={{ marginBottom: 48 }}>
                          <TextField
                            onChange={handleChange('price')}
                            label="Minimum amount to charge for bookings"
                            description={`Fans will be able to pay this in ${SYMBOL}`}
                            placeholder="0.5"
                            value={values.price}
                            type="number"
                            endText={SYMBOL}
                            onBlur={handleBlur}
                            errorMessage={errors.price}
                          />
                          {/* TODO(jonathanng) - make dynamic */}
                          <Description style={{ fontSize: 10, marginTop: '8px' }}>
                            * Includes a 10% fee to support the platform
                          </Description>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <TextField
                            onChange={handleChange('demo1')}
                            description="Add links for demo videos that will display on your bookings page (these should be tweets)"
                            placeholder="Demo tweet video link 1"
                            value={values.demo1}
                            onBlur={handleBlur}
                            errorMessage={errors.demo1}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <TextField
                            onChange={handleChange('demo2')}
                            placeholder="Demo tweet video link 2"
                            value={values.demo2}
                            onBlur={handleBlur}
                            errorMessage={errors.demo2}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <TextField
                            onChange={handleChange('demo3')}
                            placeholder="Demo tweet video link 3"
                            value={values.demo3}
                            onBlur={handleBlur}
                            errorMessage={errors.demo3}
                          />
                        </div>

                        <PrimaryButton
                          /*isDisabled={Object.keys(erros).length != 0}*/
                          style={{ marginBottom: '16px' }}
                          onPress={async () => {
                            setLoading(true)
                            const errors = await validateForm();
                            if (Object.keys(errors).length != 0) {

                              console.log(errors)
                              toast.error('Please fix the errors.');
                            } else {
                              handleSubmit();
                            }
                            setLoading(false)
                          }}
                          isDisabled={loading}
                        >
                          {hasAccount ? "Update profile" : "Set up profile"}
                        </PrimaryButton>
                      </>
                    );
                  }}
                </Formik>
              </ProfileDetailsContainer>
            </ContentWrapper>
          </PageContentWrapper>
        </PageWrapper>
      )}
      {/* {!creator && (
        <PageWrapper>
          <HeaderSpacer />
          <HeaderContentGapSpacer />
          <PageContentWrapper>
            <ContentWrapper>
              <OnboardTitle>It looks like you already have an account. Please contact {`${HELP_EMAIL}`}</OnboardTitle>
            </ContentWrapper>
          </PageContentWrapper>
        </PageWrapper>
      )} */}
    </>
  );
};

export { OnboardProfilePage };
