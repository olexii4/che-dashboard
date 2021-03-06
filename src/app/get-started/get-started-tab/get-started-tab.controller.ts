/*
 * Copyright (c) 2015-2018 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */
'use strict';

import { CreateWorkspaceSvc } from '../../workspaces/create-workspace/create-workspace.service';
import { CheWorkspace } from '../../../components/api/workspace/che-workspace.factory';
import { DevfileRegistry, IDevfileMetaData } from '../../../components/api/devfile-registry.factory';
import { CheNotification } from '../../../components/notification/che-notification.factory';
import { IChePfButtonProperties } from '../../../components/che-pf-widget/button/che-pf-button';
import { IGetStartedToolbarBindingProperties } from './toolbar/get-started-toolbar.component';
import { CheBranding } from '../../../components/branding/che-branding';


/**
 * @ngdoc controller
 * @name get.started.tab.controller:GetStartedTabController
 * @description This class is handling the controller for the Get Started page with template list
 * @author Oleksii Orel
 * @author Oleksii Kurinnyi
 */
export class GetStartedTabController {

  static $inject = [
    '$log',
    'cheNotification',
    'cheWorkspace',
    'cheBranding',
    'createWorkspaceSvc',
    'devfileRegistry'
  ];

  toolbarProps: IGetStartedToolbarBindingProperties;
  createButton: IChePfButtonProperties;
  filteredDevfiles: Array<IDevfileMetaData> = [];

  // injected services
  private $log: ng.ILogService;
  private cheNotification: CheNotification;
  private cheBranding: CheBranding;
  private createWorkspaceSvc: CreateWorkspaceSvc;
  private devfileRegistry: DevfileRegistry;

  private isLoading: boolean = false;
  private isCreating: boolean = false;
  private devfileRegistryUrl: string;
  private ephemeralMode: boolean;

  /**
   * Default constructor that is using resource
   */
  constructor(
    $log: ng.ILogService,
    cheNotification: CheNotification,
    cheWorkspace: CheWorkspace,
    cheBranding: CheBranding,
    createWorkspaceSvc: CreateWorkspaceSvc,
    devfileRegistry: DevfileRegistry
  ) {
    this.$log = $log;
    this.cheNotification = cheNotification;
    this.cheBranding = cheBranding;
    this.createWorkspaceSvc = createWorkspaceSvc;
    this.devfileRegistry = devfileRegistry;

    this.toolbarProps = {
      devfiles: [],
      ephemeralMode: false,
      onFilterChange: filtered => this.onFilterChange(filtered),
      onEphemeralModeChange: mode => this.onEphemeralModeChange(mode),
    };

    this.isLoading = true;
    cheWorkspace.fetchWorkspaceSettings().then(() => {
      const workspaceSettings = cheWorkspace.getWorkspaceSettings();
      this.devfileRegistryUrl = workspaceSettings && workspaceSettings.cheWorkspaceDevfileRegistryUrl;
      this.ephemeralMode = workspaceSettings['che.workspace.persist_volumes.default'] === 'false';
      this.toolbarProps.ephemeralMode = this.ephemeralMode;
      return this.init();
    }).finally(() => {
      this.isLoading = false;
    });
  }

  isCreateButtonDisabled(): boolean {
    return this.isCreating;
  }

  onFilterChange(filteredDevfiles: IDevfileMetaData[]): void {
    this.filteredDevfiles = filteredDevfiles;
  }

  onEphemeralModeChange(mode: boolean): void {
    this.ephemeralMode = mode;
  }

  createWorkspace(devfileMetaData: IDevfileMetaData): void {
    if (this.isCreating) {
      return;
    }
    if (!devfileMetaData || !devfileMetaData.links || !devfileMetaData.links.self) {
      const message = 'There is no selected Template.';
      this.cheNotification.showError(message);
      this.$log.error(message);
      return;
    }
    this.isCreating = true;
    const selfLink = devfileMetaData.links.self;
    this.devfileRegistry.fetchDevfile(this.devfileRegistryUrl, selfLink)
      .then(() => {
        const devfile = this.devfileRegistry.getDevfile(this.devfileRegistryUrl, selfLink);
        if (this.ephemeralMode) {
          if (!devfile.attributes) {
            devfile.attributes = {};
          }
          devfile.attributes.persistVolumes = 'false';
        }
        const attributes = {stackName: devfileMetaData.displayName};
        return this.createWorkspaceSvc.createWorkspaceFromDevfile(undefined, devfile, attributes, true);
      })
      .then(workspace => {
        return this.createWorkspaceSvc.redirectToIDE(workspace);
      })
      .finally(() => {
        this.isCreating = false;
      });
  }

  private init(): ng.IPromise<void> {
    if (!this.devfileRegistryUrl) {
      const message = 'Failed to load the devfile registry URL.';
      this.cheNotification.showError(message);
      this.$log.error(message);
      return;
    }

    this.isLoading = true;
    return this.devfileRegistry.fetchDevfiles(this.devfileRegistryUrl)
      .then(devfiles => {
        this.toolbarProps.devfiles = devfiles;
      }, error => {
        const message = 'Failed to load devfiles meta list.';
        this.cheNotification.showError(message);
        this.$log.error(message, error);
      }).finally(() => {
        this.isLoading = false;
      });
  }

}
